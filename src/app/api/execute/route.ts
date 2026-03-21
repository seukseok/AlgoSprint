import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JudgeAction } from "@/lib/types";
import { compileAndRun } from "@/lib/runner";
import { requireSessionUser } from "@/lib/session-user";

type ExecuteRequest = {
  action: Exclude<JudgeAction, "submit">;
  problemId: string;
  source: string;
  stdin?: string;
};

export async function POST(request: Request) {
  try {
    const session = await requireSessionUser();
    if (session.error) return session.error;

    const body = (await request.json()) as ExecuteRequest;

    if (!body?.action || !body.problemId || !body.source) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const stdin = body.stdin ?? "";
    const execution = await compileAndRun(body.source, body.action === "run" ? stdin : "");

    let output = "";
    if (body.action === "compile") {
      output = execution.compileError ? execution.compileError : "Compilation successful.";
    } else if (body.action === "debug") {
      output = `${execution.stdout}${execution.stderr ? `\n[stderr]\n${execution.stderr}` : ""}`.trim() || "Debug run completed.";
    } else {
      output = `${execution.stdout}${execution.stderr ? `\n[stderr]\n${execution.stderr}` : ""}`.trim();
    }

    if (execution.timedOut) {
      output = `${output}\n[runner] time limit exceeded`.trim();
    }

    const success = body.action === "compile" ? !execution.compileError : execution.success;

    await prisma.run.create({
      data: {
        action: body.action,
        source: body.source,
        stdin,
        output,
        stderr: execution.stderr || null,
        success,
        timeMs: execution.elapsedMs,
        memoryKb: null,
        exitCode: execution.exitCode,
        userId: session.user.id,
        problemId: body.problemId,
      },
    });

    return NextResponse.json({
      action: body.action,
      success,
      output,
      timeMs: execution.elapsedMs,
      memoryKb: undefined,
      exitCode: execution.exitCode,
    });
  } catch {
    return NextResponse.json({ error: "Execution failed. Please try again." }, { status: 500 });
  }
}
