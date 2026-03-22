import { NextResponse } from "next/server";
import { compileAndRun } from "@/lib/runner";
import { validateSubmitPayload } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const payload = validateSubmitPayload(await request.json());
    if (!payload.ok) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const compileResult = await compileAndRun(payload.value.source, "");

    if (compileResult.compileError) {
      return NextResponse.json({
        action: "submit",
        success: false,
        output: `제출 전 컴파일에 실패했습니다.\n${compileResult.compileError}`,
        timeMs: compileResult.elapsedMs,
      });
    }

    return NextResponse.json({
      action: "submit",
      success: true,
      output:
        "코드가 제출 가능한 상태입니다.\n이 앱은 BOJ 계정으로 직접 제출하지 않으므로, '코드 복사' 후 BOJ 제출 페이지에 붙여넣어 제출하세요.",
      timeMs: compileResult.elapsedMs,
    });
  } catch {
    return NextResponse.json({ error: "제출 처리 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
