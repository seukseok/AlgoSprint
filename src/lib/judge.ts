import { JudgeAction, JudgeResult } from "./types";

async function executeServerAction(params: {
  action: Exclude<JudgeAction, "submit">;
  source: string;
  stdin: string;
}): Promise<JudgeResult> {
  const response = await fetch("/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorMessage = await readError(response, "서버 실행 요청에 실패했습니다.");
    return {
      action: params.action,
      success: false,
      output: errorMessage,
    };
  }

  return (await response.json()) as JudgeResult;
}

async function submitCode(params: { source: string }): Promise<JudgeResult> {
  const response = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: params.source, language: "cpp17" }),
  });

  if (!response.ok) {
    return {
      action: "submit",
      success: false,
      output: await readError(response, "제출 요청에 실패했습니다."),
    };
  }

  return (await response.json()) as JudgeResult;
}

export async function executeJudgeAction(params: {
  action: JudgeAction;
  source: string;
  stdin: string;
}) {
  const { action, source, stdin } = params;

  if (action === "submit") {
    return submitCode({ source });
  }

  return executeServerAction({ action, source, stdin });
}

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string; retryAfterSec?: number };
    if (response.status === 429 && body.retryAfterSec) {
      return `${body.error ?? fallback}\n재시도 가능 시간: ${body.retryAfterSec}초 후`;
    }
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}
