import { JudgeAction, JudgeResult } from "./types";

export interface JudgeGateway {
  compile(source: string, language: "cpp17"): Promise<JudgeResult>;
  run(source: string, stdin: string, language: "cpp17"): Promise<JudgeResult>;
  debug(source: string, stdin: string, language: "cpp17"): Promise<JudgeResult>;
  submit(problemId: string, source: string, language: "cpp17"): Promise<JudgeResult>;
}

class MockJudgeGateway implements JudgeGateway {
  private fakeDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async compile(source: string): Promise<JudgeResult> {
    await this.fakeDelay(500);
    const hasMain = source.includes("main(");
    return {
      action: "compile",
      success: hasMain,
      output: hasMain
        ? "Compilation successful (mock). Ready to run."
        : "Compilation failed (mock): missing main()",
    };
  }

  async run(source: string, stdin: string): Promise<JudgeResult> {
    await this.fakeDelay(700);
    return {
      action: "run",
      success: true,
      output: `Program executed (mock).\\nInput:\\n${stdin || "(empty)"}\\n\\nOutput:\\nHello from local runner placeholder.`,
      timeMs: 8,
      memoryKb: 2560,
    };
  }

  async debug(_source: string, _stdin: string): Promise<JudgeResult> {
    void _source;
    void _stdin;
    await this.fakeDelay(600);
    return {
      action: "debug",
      success: true,
      output:
        "Debug session is currently a mock flow.\\nBreakpoint panel and step controls are UI-ready for backend integration.",
    };
  }

  async submit(problemId: string): Promise<JudgeResult> {
    await this.fakeDelay(900);
    return {
      action: "submit",
      success: true,
      output: `Submission queued to judge (mock).\\nProblem: ${problemId}\\nVerdict: Pending`,
    };
  }
}

export const judgeGateway: JudgeGateway = new MockJudgeGateway();

export async function executeJudgeAction(params: {
  action: JudgeAction;
  source: string;
  stdin: string;
  problemId: string;
}) {
  const { action, source, stdin, problemId } = params;
  if (action === "compile") return judgeGateway.compile(source, "cpp17");
  if (action === "run") return judgeGateway.run(source, stdin, "cpp17");
  if (action === "debug") return judgeGateway.debug(source, stdin, "cpp17");
  return judgeGateway.submit(problemId, source, "cpp17");
}
