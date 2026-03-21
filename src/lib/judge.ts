import { JudgeAction, JudgeResult } from "./types";

type SafeCaseSummary = {
  index: number;
  scope: "sample" | "hidden";
  passed: boolean;
  verdict: "PASS" | "WRONG_ANSWER" | "RUNTIME_ERROR" | "TIME_LIMIT_EXCEEDED";
};

type SafeStats = {
  totalTests: number;
  passedTests: number;
  failedIndexes: number[];
};

async function executeServerAction(params: {
  action: Exclude<JudgeAction, "submit">;
  source: string;
  stdin: string;
  problemId: string;
}): Promise<JudgeResult> {
  const response = await fetch("/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    return {
      action: params.action,
      success: false,
      output: response.status === 401 ? "로그인 후 이용해 주세요." : "서버 실행 요청에 실패했습니다.",
    };
  }

  return (await response.json()) as JudgeResult;
}

async function submitAndPoll(params: { source: string; problemId: string }): Promise<JudgeResult> {
  const submitResponse = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: params.source,
      problemId: params.problemId,
      language: "cpp17",
    }),
  });

  if (!submitResponse.ok) {
    return {
      action: "submit",
      success: false,
      output: submitResponse.status === 401 ? "로그인 후 이용해 주세요." : "제출 요청에 실패했습니다.",
    };
  }

  const submitData = (await submitResponse.json()) as { submissionId: string };

  for (let i = 0; i < 8; i += 1) {
    await sleep(900);
    const poll = await fetch(`/api/submissions/${submitData.submissionId}`, { cache: "no-store" });
    if (!poll.ok) break;

    const polled = (await poll.json()) as {
      status: string;
      done: boolean;
      output: string;
      testcaseSummary?: SafeCaseSummary[];
      stats?: SafeStats;
    };

    if (polled.done) {
      const stats = polled.stats;
      const visibleFailed = (polled.testcaseSummary ?? []).filter((tc) => !tc.passed).map((tc) => `#${tc.index}(${tc.scope === "sample" ? "샘플" : "숨김"}, ${toVerdictLabel(tc.verdict)})`);
      const statsText = stats
        ? `총 ${stats.totalTests}개 중 ${stats.passedTests}개 통과\n실패한 테스트 번호: ${stats.failedIndexes.length ? stats.failedIndexes.join(", ") : "없음"}`
        : "";

      return {
        action: "submit",
        success: polled.status === "ACCEPTED",
        output: [polled.output, statsText, visibleFailed.length ? `실패 힌트: ${visibleFailed.join(", ")}` : ""].filter(Boolean).join("\n"),
      };
    }
  }

  return {
    action: "submit",
    success: true,
    output: "제출이 접수되었습니다. 채점이 지연되고 있어 잠시 후 제출 기록에서 확인해 주세요.",
  };
}

export async function executeJudgeAction(params: {
  action: JudgeAction;
  source: string;
  stdin: string;
  problemId: string;
}) {
  const { action, source, stdin, problemId } = params;

  if (action === "submit") {
    return submitAndPoll({ source, problemId });
  }

  return executeServerAction({ action, source, stdin, problemId });
}

function toVerdictLabel(verdict: SafeCaseSummary["verdict"]) {
  switch (verdict) {
    case "RUNTIME_ERROR":
      return "RE";
    case "TIME_LIMIT_EXCEEDED":
      return "TLE";
    case "WRONG_ANSWER":
      return "WA";
    default:
      return "PASS";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
