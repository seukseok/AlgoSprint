import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { problemCatalog } from "./problem-catalog";
import { hiddenTestCatalog, InternalTestcase } from "./problem-hidden-tests";
import { validateProblemCatalogIntegrity } from "./problem-catalog-validator";
import { RUNNER_COMPILER, RUNNER_DENYLIST_PATTERNS, RUNNER_LIMITS, RUNNER_RUNTIME } from "./runner-config";
import { logEvent } from "./logger";

export type ExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  compileError?: string;
  exitCode: number | null;
  elapsedMs: number;
  timedOut?: boolean;
};

type CaseScope = "sample" | "hidden";
type CaseVerdict = "PASS" | "WRONG_ANSWER" | "RUNTIME_ERROR" | "TIME_LIMIT_EXCEEDED";

export type SubmissionCaseResult = {
  index: number;
  scope: CaseScope;
  passed: boolean;
  verdict: CaseVerdict;
  elapsedMs: number;
  exitCode: number | null;
  timedOut: boolean;
};

export type SubmissionSummaryStats = {
  totalTests: number;
  passedTests: number;
  failedIndexes: number[];
};

export function checkForbiddenSource(source: string): string | null {
  if (Buffer.byteLength(source, "utf8") > RUNNER_LIMITS.maxSourceBytes) {
    return `Source too large (>${RUNNER_LIMITS.maxSourceBytes} bytes)`;
  }

  const hit = RUNNER_DENYLIST_PATTERNS.find((pattern) => pattern.test(source));
  return hit ? `Forbidden pattern detected: ${hit}` : null;
}

export async function compileAndRun(source: string, stdin: string): Promise<ExecutionResult> {
  const forbidden = checkForbiddenSource(source);
  if (forbidden) {
    return failureFromForbidden(forbidden);
  }

  const workspace = await createWorkspace("algosprint");
  const sourcePath = path.join(workspace, sanitizeFileName("main.cpp"));
  const binaryPath = path.join(workspace, sanitizeFileName("main.out"));

  try {
    await fs.writeFile(sourcePath, source, "utf8");
    const compile = await runProcess(RUNNER_COMPILER.command, [...RUNNER_COMPILER.args, sourcePath, "-o", binaryPath], {
      timeoutMs: RUNNER_LIMITS.compileTimeoutMs,
      stage: "compile",
    });

    if (!compile.ok) {
      return {
        success: false,
        stdout: compile.stdout,
        stderr: compile.stderr,
        compileError: compile.stderr || "Compilation failed",
        exitCode: compile.exitCode,
        elapsedMs: compile.elapsedMs,
        timedOut: compile.timedOut,
      };
    }

    const run = await runProcess(binaryPath, [], { timeoutMs: RUNNER_LIMITS.runTimeoutMs, stdin, stage: "run" });
    return {
      success: !run.timedOut && run.exitCode === 0,
      stdout: run.stdout,
      stderr: run.stderr,
      exitCode: run.exitCode,
      elapsedMs: run.elapsedMs,
      timedOut: run.timedOut,
    };
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

export async function judgeSubmission(problemId: string, source: string) {
  validateProblemCatalogIntegrity();

  const problem = problemCatalog.find((item) => item.id === problemId);
  const sampleTests = problem?.sampleTests ?? [];
  const hiddenTests = hiddenTestCatalog[problemId] ?? [];
  const tests = [
    ...sampleTests.map((tc) => ({ ...tc, scope: "sample" as const })),
    ...hiddenTests.map((tc) => ({ ...tc, scope: "hidden" as const })),
  ];

  if (!tests.length) {
    return {
      status: "WRONG_ANSWER" as const,
      output: "평가용 테스트케이스가 설정되지 않았습니다.",
      elapsedMs: 0,
      exitCode: null,
      summary: [] as SubmissionCaseResult[],
      stats: { totalTests: 0, passedTests: 0, failedIndexes: [] } as SubmissionSummaryStats,
    };
  }

  const forbidden = checkForbiddenSource(source);
  if (forbidden) {
    return {
      status: "COMPILATION_ERROR" as const,
      output: `컴파일 오류\n${forbidden}`,
      elapsedMs: 0,
      exitCode: null,
      summary: [] as SubmissionCaseResult[],
      stats: { totalTests: tests.length, passedTests: 0, failedIndexes: [] } as SubmissionSummaryStats,
    };
  }

  const workspace = await createWorkspace("algosprint-sub");
  const sourcePath = path.join(workspace, sanitizeFileName("main.cpp"));
  const binaryPath = path.join(workspace, sanitizeFileName("main.out"));

  try {
    await fs.writeFile(sourcePath, source, "utf8");
    const compile = await runProcess(RUNNER_COMPILER.command, [...RUNNER_COMPILER.args, sourcePath, "-o", binaryPath], {
      timeoutMs: RUNNER_LIMITS.compileTimeoutMs,
      stage: "compile",
    });

    if (!compile.ok) {
      return {
        status: "COMPILATION_ERROR" as const,
        output: `컴파일 오류\n${compile.stderr || "Compilation failed"}`,
        elapsedMs: compile.elapsedMs,
        exitCode: compile.exitCode,
        summary: [] as SubmissionCaseResult[],
        stats: { totalTests: tests.length, passedTests: 0, failedIndexes: [] } as SubmissionSummaryStats,
      };
    }

    const summary: SubmissionCaseResult[] = [];
    let totalElapsed = compile.elapsedMs;
    let latestExitCode: number | null = 0;

    for (let i = 0; i < tests.length; i += 1) {
      const tc = tests[i];
      const result = await runProcess(binaryPath, [], { timeoutMs: RUNNER_LIMITS.runTimeoutMs, stdin: tc.input, stage: "judge" });
      totalElapsed += result.elapsedMs;
      latestExitCode = result.exitCode;

      const verdict = computeCaseVerdict(result, tc);
      const passed = verdict === "PASS";

      summary.push({
        index: i + 1,
        scope: tc.scope,
        passed,
        verdict,
        elapsedMs: result.elapsedMs,
        exitCode: result.exitCode,
        timedOut: Boolean(result.timedOut),
      });

      if (!passed) {
        const stats = buildSummaryStats(summary, tests.length);
        return {
          status: mapStatusFromVerdict(verdict),
          output: formatFailureMessage(i + 1, tc.scope, verdict, stats),
          elapsedMs: totalElapsed,
          exitCode: latestExitCode,
          summary,
          stats,
        };
      }
    }

    const stats = buildSummaryStats(summary, tests.length);
    return {
      status: "ACCEPTED" as const,
      output: `정답입니다. 총 ${stats.totalTests}개 테스트를 모두 통과했습니다.`,
      elapsedMs: totalElapsed,
      exitCode: latestExitCode,
      summary,
      stats,
    };
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

function computeCaseVerdict(result: { stdout: string; exitCode: number | null; timedOut: boolean }, tc: InternalTestcase): CaseVerdict {
  if (result.timedOut) return "TIME_LIMIT_EXCEEDED";
  if (result.exitCode !== 0) return "RUNTIME_ERROR";
  const actual = normalize(result.stdout);
  const expected = normalize(tc.output);
  return actual === expected ? "PASS" : "WRONG_ANSWER";
}

function buildSummaryStats(summary: SubmissionCaseResult[], totalTests: number): SubmissionSummaryStats {
  const passedTests = summary.filter((item) => item.passed).length;
  const failedIndexes = summary.filter((item) => !item.passed).map((item) => item.index);
  return {
    totalTests,
    passedTests,
    failedIndexes,
  };
}

function formatFailureMessage(index: number, scope: CaseScope, verdict: CaseVerdict, stats: SubmissionSummaryStats) {
  const scopeLabel = scope === "sample" ? "샘플" : "숨김";
  const verdictLabel =
    verdict === "WRONG_ANSWER"
      ? "오답"
      : verdict === "RUNTIME_ERROR"
        ? "런타임 오류"
        : verdict === "TIME_LIMIT_EXCEEDED"
          ? "시간 초과"
          : "실패";

  const failed = stats.failedIndexes.length ? stats.failedIndexes.join(", ") : "-";
  return `${verdictLabel} (${scopeLabel} 테스트 #${index})\n통과: ${stats.passedTests}/${stats.totalTests}\n실패한 테스트 번호: ${failed}`;
}

function mapStatusFromVerdict(verdict: CaseVerdict) {
  switch (verdict) {
    case "TIME_LIMIT_EXCEEDED":
      return "TIME_LIMIT_EXCEEDED" as const;
    case "RUNTIME_ERROR":
      return "RUNTIME_ERROR" as const;
    case "WRONG_ANSWER":
      return "WRONG_ANSWER" as const;
    default:
      return "WRONG_ANSWER" as const;
  }
}

function normalize(value: string) {
  return value.replace(/\s+$/g, "").trimEnd();
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
}

async function createWorkspace(prefix: string) {
  const safePrefix = sanitizeFileName(prefix);
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), `${safePrefix}-`));
  const resolved = path.resolve(workspace);
  const tmp = path.resolve(os.tmpdir());
  if (!resolved.startsWith(tmp)) {
    throw new Error("Invalid workspace path");
  }
  return resolved;
}

function safeTruncate(text: string, maxBytes: number) {
  const buffer = Buffer.from(text, "utf8");
  if (buffer.byteLength <= maxBytes) return text;
  return `${buffer.subarray(0, maxBytes).toString("utf8")}\n[truncated]`;
}

function failureFromForbidden(message: string): ExecutionResult {
  return {
    success: false,
    stdout: "",
    stderr: message,
    compileError: message,
    exitCode: null,
    elapsedMs: 0,
  };
}

async function runProcess(
  command: string,
  args: string[],
  options: { timeoutMs: number; stdin?: string; stage: "compile" | "run" | "judge" },
): Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number | null; elapsedMs: number; timedOut: boolean }> {
  const start = Date.now();

  return new Promise((resolve) => {
    const env = Object.fromEntries(
      RUNNER_RUNTIME.envAllowlist
        .map((key) => [key, process.env[key]])
        .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );

    const child = spawn(command, args, { stdio: "pipe", env: { ...process.env, ...env } });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let total = 0;
    let killedForOutput = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > RUNNER_LIMITS.outputLimitBytes) {
        killedForOutput = true;
        child.kill("SIGKILL");
        return;
      }
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > RUNNER_LIMITS.outputLimitBytes) {
        killedForOutput = true;
        child.kill("SIGKILL");
        return;
      }
      stderrChunks.push(chunk);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      let stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (killedForOutput) {
        stderr += "\n[runner] output limit exceeded";
      }
      stderr = safeTruncate(stderr, RUNNER_LIMITS.stderrLogLimitBytes);
      const elapsedMs = Date.now() - start;
      const ok = !timedOut && !killedForOutput && code === 0;

      logEvent(ok ? "info" : "warn", "runner.process.finished", {
        stage: options.stage,
        command,
        exitCode: code,
        elapsedMs,
        timedOut,
        killedForOutput,
      });

      resolve({
        ok,
        stdout,
        stderr,
        exitCode: code,
        elapsedMs,
        timedOut,
      });
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();
  });
}
