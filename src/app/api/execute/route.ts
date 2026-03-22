import { NextResponse } from "next/server";
import { compileAndRun } from "@/lib/runner";
import { validateExecutePayload } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const payload = validateExecutePayload(await request.json());
    if (!payload.ok) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const { action, source, stdin } = payload.value;
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

    return NextResponse.json({
      action,
      success,
      output,
      timeMs: execution.elapsedMs,
      memoryKb: undefined,
      exitCode: execution.exitCode,
    });
  } catch {
    return NextResponse.json({ error: "실행 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
