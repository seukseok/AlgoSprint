import { JudgeAction } from "@/lib/types";

const MAX_SOURCE_LEN = 128 * 1024;
const MAX_STDIN_LEN = 8 * 1024;

export function validateExecutePayload(body: unknown):
  | { ok: true; value: { action: Exclude<JudgeAction, "submit">; problemId: string; source: string; stdin: string } }
  | { ok: false; error: string } {
  const base = validateCommonPayload(body);
  if (!base.ok) return base;

  if (!["compile", "run", "debug"].includes(base.value.action)) {
    return { ok: false, error: "지원하지 않는 실행 액션입니다." };
  }

  return {
    ok: true,
    value: {
      action: base.value.action as Exclude<JudgeAction, "submit">,
      problemId: base.value.problemId,
      source: base.value.source,
      stdin: base.value.stdin,
    },
  };
}

export function validateSubmitPayload(body: unknown):
  | { ok: true; value: { problemId: string; source: string; language: string } }
  | { ok: false; error: string } {
  const base = validateCommonPayload(body);
  if (!base.ok) return base;

  return {
    ok: true,
    value: {
      problemId: base.value.problemId,
      source: base.value.source,
      language: "cpp17",
    },
  };
}

function validateCommonPayload(body: unknown):
  | { ok: true; value: { action: string; problemId: string; source: string; stdin: string } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "요청 본문 형식이 올바르지 않습니다." };
  }

  const data = body as Record<string, unknown>;
  const action = typeof data.action === "string" ? data.action.trim() : "";
  const problemId = typeof data.problemId === "string" ? data.problemId.trim() : "";
  const source = typeof data.source === "string" ? data.source : "";
  const stdin = typeof data.stdin === "string" ? data.stdin : "";

  if (!problemId) return { ok: false, error: "문제 ID가 필요합니다." };
  if (!source.trim()) return { ok: false, error: "코드를 입력해 주세요." };
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_LEN) return { ok: false, error: "코드 길이가 허용 범위를 초과했습니다." };
  if (Buffer.byteLength(stdin, "utf8") > MAX_STDIN_LEN) return { ok: false, error: "입력(stdin) 길이가 너무 깁니다." };

  return { ok: true, value: { action, problemId, source, stdin } };
}
