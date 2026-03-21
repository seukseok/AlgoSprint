import { JudgeAction, JudgeResult } from "./types";

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
      output: response.status === 401 ? "Please sign in first." : "Server execute request failed.",
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
      output: submitResponse.status === 401 ? "Please sign in first." : "Submit request failed.",
    };
  }

  const submitData = (await submitResponse.json()) as { submissionId: string };

  for (let i = 0; i < 8; i += 1) {
    await sleep(900);
    const poll = await fetch(`/api/submissions/${submitData.submissionId}`, { cache: "no-store" });
    if (!poll.ok) break;
    const polled = (await poll.json()) as { status: string; done: boolean; output: string };
    if (polled.done) {
      const details = Array.isArray((polled as { testcaseSummary?: unknown[] }).testcaseSummary)
        ? ((polled as { testcaseSummary?: { index: number; passed: boolean }[] }).testcaseSummary ?? [])
            .map((tc) => `#${tc.index}: ${tc.passed ? "PASS" : "FAIL"}`)
            .join("\n")
        : "";

      return {
        action: "submit",
        success: polled.status === "ACCEPTED",
        output: `${polled.output}\nStatus: ${polled.status}${details ? `\n${details}` : ""}`,
      };
    }
  }

  return {
    action: "submit",
    success: true,
    output: "Submission queued. Verdict still pending.",
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
