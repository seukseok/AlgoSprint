import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { problemCatalog } from "./problem-catalog";
import { RUNNER_DENYLIST_PATTERNS, RUNNER_LIMITS } from "./runner-config";

export type ExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  compileError?: string;
  exitCode: number | null;
  elapsedMs: number;
  timedOut?: boolean;
};

export type SubmissionCaseResult = {
  index: number;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  elapsedMs: number;
  exitCode: number | null;
  timedOut: boolean;
  stderr?: string;
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
    const compile = await runProcess("g++", ["-std=c++17", "-O2", "-pipe", sourcePath, "-o", binaryPath], {
      timeoutMs: RUNNER_LIMITS.compileTimeoutMs,
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

    const run = await runProcess(binaryPath, [], { timeoutMs: RUNNER_LIMITS.runTimeoutMs, stdin });
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
  const problem = problemCatalog.find((item) => item.id === problemId);
  const tests = problem?.sampleTests ?? [];

  if (!tests.length) {
    return {
      status: "WRONG_ANSWER" as const,
      output: "No sample testcases configured for this problem.",
      elapsedMs: 0,
      exitCode: null,
      summary: [] as SubmissionCaseResult[],
    };
  }

  const forbidden = checkForbiddenSource(source);
  if (forbidden) {
    return {
      status: "COMPILATION_ERROR" as const,
      output: forbidden,
      elapsedMs: 0,
      exitCode: null,
      summary: [] as SubmissionCaseResult[],
    };
  }

  const workspace = await createWorkspace("algosprint-sub");
  const sourcePath = path.join(workspace, sanitizeFileName("main.cpp"));
  const binaryPath = path.join(workspace, sanitizeFileName("main.out"));

  try {
    await fs.writeFile(sourcePath, source, "utf8");
    const compile = await runProcess("g++", ["-std=c++17", "-O2", "-pipe", sourcePath, "-o", binaryPath], {
      timeoutMs: RUNNER_LIMITS.compileTimeoutMs,
    });

    if (!compile.ok) {
      return {
        status: "COMPILATION_ERROR" as const,
        output: `Compilation Error\n${compile.stderr || "Compilation failed"}`,
        elapsedMs: compile.elapsedMs,
        exitCode: compile.exitCode,
        summary: [] as SubmissionCaseResult[],
      };
    }

    const summary: SubmissionCaseResult[] = [];
    let totalElapsed = compile.elapsedMs;
    let latestExitCode: number | null = 0;

    for (let i = 0; i < tests.length; i += 1) {
      const tc = tests[i];
      const result = await runProcess(binaryPath, [], { timeoutMs: RUNNER_LIMITS.runTimeoutMs, stdin: tc.input });
      totalElapsed += result.elapsedMs;
      latestExitCode = result.exitCode;

      const actual = normalize(result.stdout);
      const expected = normalize(tc.output);
      const passed = !result.timedOut && result.exitCode === 0 && actual === expected;

      summary.push({
        index: i + 1,
        passed,
        input: tc.input,
        expected: tc.output,
        actual: result.stdout,
        elapsedMs: result.elapsedMs,
        exitCode: result.exitCode,
        timedOut: Boolean(result.timedOut),
        stderr: result.stderr || undefined,
      });

      if (result.timedOut) {
        return {
          status: "TIME_LIMIT_EXCEEDED" as const,
          output: `TLE on sample #${i + 1}`,
          elapsedMs: totalElapsed,
          exitCode: result.exitCode,
          summary,
        };
      }

      if (result.exitCode !== 0) {
        return {
          status: "RUNTIME_ERROR" as const,
          output: `RE on sample #${i + 1}\n${result.stderr}`,
          elapsedMs: totalElapsed,
          exitCode: result.exitCode,
          summary,
        };
      }

      if (!passed) {
        return {
          status: "WRONG_ANSWER" as const,
          output: `WA on sample #${i + 1}`,
          elapsedMs: totalElapsed,
          exitCode: latestExitCode,
          summary,
        };
      }
    }

    return {
      status: "ACCEPTED" as const,
      output: `Accepted on ${tests.length} sample testcase(s).`,
      elapsedMs: totalElapsed,
      exitCode: latestExitCode,
      summary,
    };
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
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
  options: { timeoutMs: number; stdin?: string },
): Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number | null; elapsedMs: number; timedOut: boolean }> {
  const start = Date.now();

  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "pipe" });
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

      resolve({
        ok: !timedOut && !killedForOutput && code === 0,
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
