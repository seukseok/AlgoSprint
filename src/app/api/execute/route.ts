import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compileAndRun } from "@/lib/runner";
import { requireSessionUser } from "@/lib/session-user";
import { checkRateLimit, getClientIp, rateLimitErrorResponse } from "@/lib/rate-limit";
import { validateExecutePayload } from "@/lib/validation";
import { logEvent } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const session = await requireSessionUser();
    if (session.error) return session.error;

    const ip = getClientIp(request);
    const limited = checkRateLimit("execute", session.user.id, ip);
    if (limited.limited) {
      return rateLimitErrorResponse("execute", limited.retryAfterSec, limited.headers);
    }

    const payload = validateExecutePayload(await request.json());
    if (!payload.ok) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const { action, problemId, source, stdin } = payload.value;
    const execution = await compileAndRun(source, action === "run" ? stdin : "");

    let output = "";
    if (action === "compile") {
      output = execution.compileError ? execution.compileError : "컴파일이 완료되었습니다.";
    } else if (action === "debug") {
      output = `${execution.stdout}${execution.stderr ? `\n[stderr]\n${execution.stderr}` : ""}`.trim() || "디버그 실행이 완료되었습니다.";
    } else {
      output = `${execution.stdout}${execution.stderr ? `\n[stderr]\n${execution.stderr}` : ""}`.trim();
    }

    if (execution.timedOut) {
      output = `${output}\n[runner] time limit exceeded`.trim();
    }

    const success = action === "compile" ? !execution.compileError : execution.success;

    await prisma.run.create({
      data: {
        action,
        source,
        stdin,
        output,
        stderr: execution.stderr || null,
        success,
        timeMs: execution.elapsedMs,
        memoryKb: null,
        exitCode: execution.exitCode,
        userId: session.user.id,
        problemId,
      },
    });

    logEvent("info", "judge.execute", { action, userId: session.user.id, problemId, success, elapsedMs: execution.elapsedMs });

    return NextResponse.json({
      action,
      success,
      output,
      timeMs: execution.elapsedMs,
      memoryKb: undefined,
      exitCode: execution.exitCode,
    });
  } catch (error) {
    logEvent("error", "judge.execute.failed", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "실행 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
