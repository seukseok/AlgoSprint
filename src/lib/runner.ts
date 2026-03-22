import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { RUNNER_COMPILER, RUNNER_DENYLIST_PATTERNS, RUNNER_EXECUTION, RUNNER_LIMITS, RUNNER_RUNTIME } from "./runner-config";
import { logEvent } from "./logger";
import { ERROR_CODES } from "./error-codes";

const MAX_CONCURRENCY = Math.max(1, Number(process.env.RUNNER_MAX_CONCURRENCY ?? "2"));
let activeRuns = 0;
const waitingResolvers: Array<() => void> = [];

const HAS_PRLIMIT = spawnSync("bash", ["-lc", "command -v prlimit >/dev/null 2>&1"], { stdio: "ignore" }).status === 0;
const HAS_GPP = spawnSync("bash", ["-lc", "command -v g++ >/dev/null 2>&1"], { stdio: "ignore" }).status === 0;
const COMPILER_BACKEND = (process.env.COMPILER_BACKEND ?? "auto").toLowerCase();
const PISTON_URL = process.env.PISTON_URL ?? "https://emkc.org/api/v2/piston/execute";

export type ExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  compileError?: string;
  exitCode: number | null;
  elapsedMs: number;
  timedOut?: boolean;
};

export function checkForbiddenSource(source: string): string | null {
  if (Buffer.byteLength(source, "utf8") > RUNNER_LIMITS.maxSourceBytes) {
    return `Source too large (>${RUNNER_LIMITS.maxSourceBytes} bytes)`;
  }

  const hit = RUNNER_DENYLIST_PATTERNS.find((pattern) => pattern.test(source));
  return hit ? `Forbidden pattern detected: ${hit}` : null;
}

export async function compileAndRun(source: string, stdin: string): Promise<ExecutionResult> {
  return withRunPermit(async () => {
    const forbidden = checkForbiddenSource(source);
    if (forbidden) {
      return failureFromForbidden(forbidden);
    }

    if (shouldUsePiston()) {
      return runWithPiston(source, stdin);
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
      await cleanupWorkspace(workspace);
    }
  });
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
}

function shouldUsePiston() {
  if (COMPILER_BACKEND === "piston") return true;
  if (COMPILER_BACKEND === "local") return false;
  return !HAS_GPP;
}

async function runWithPiston(source: string, stdin: string): Promise<ExecutionResult> {
  const started = Date.now();
  const candidates = [process.env.PISTON_CPP_VERSION, "17.0.0", "10.2.0"].filter(Boolean) as string[];

  for (const version of candidates) {
    try {
      const response = await fetch(PISTON_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "cpp",
          version,
          files: [{ content: source }],
          stdin,
          compile_timeout: RUNNER_LIMITS.compileTimeoutMs,
          run_timeout: RUNNER_LIMITS.runTimeoutMs,
        }),
      });

      if (!response.ok) continue;
      const data = (await response.json()) as {
        compile?: { code?: number | null; stdout?: string; stderr?: string; output?: string };
        run?: { code?: number | null; stdout?: string; stderr?: string; output?: string; signal?: string };
        message?: string;
      };

      const compileStderr = data.compile?.stderr ?? "";
      const compileCode = data.compile?.code ?? 0;
      if (compileCode !== 0) {
        return {
          success: false,
          stdout: data.compile?.stdout ?? "",
          stderr: compileStderr,
          compileError: compileStderr || data.compile?.output || "Compilation failed",
          exitCode: compileCode,
          elapsedMs: Date.now() - started,
          timedOut: /tim(e|ed)\s*out/i.test(compileStderr),
        };
      }

      const runStdout = data.run?.stdout ?? data.run?.output ?? "";
      const runStderr = data.run?.stderr ?? "";
      const runCode = data.run?.code ?? null;
      const timedOut = data.run?.signal === "SIGKILL" || /tim(e|ed)\s*out/i.test(runStderr);

      return {
        success: !timedOut && runCode === 0,
        stdout: runStdout,
        stderr: runStderr,
        exitCode: runCode,
        elapsedMs: Date.now() - started,
        timedOut,
      };
    } catch {
      // try next version
    }
  }

  return {
    success: false,
    stdout: "",
    stderr: `[${ERROR_CODES.RUNNER_RUNTIME_FAILED}] 외부 컴파일 서버 연결에 실패했습니다.`,
    compileError: "외부 컴파일 서버 연결 실패",
    exitCode: null,
    elapsedMs: Date.now() - started,
  };
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

async function cleanupWorkspace(workspace: string) {
  for (let i = 0; i < 3; i += 1) {
    try {
      await fs.rm(workspace, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 60 * (i + 1)));
    }
  }
}

function safeTruncate(text: string, maxBytes: number) {
  const buffer = Buffer.from(text, "utf8");
  if (buffer.byteLength <= maxBytes) return text;
  return `${buffer.subarray(0, maxBytes).toString("utf8")}\n[truncated]`;
}

async function withRunPermit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRuns >= MAX_CONCURRENCY) {
    await new Promise<void>((resolve) => waitingResolvers.push(resolve));
  }
  activeRuns += 1;

  try {
    return await fn();
  } finally {
    activeRuns = Math.max(0, activeRuns - 1);
    const next = waitingResolvers.shift();
    if (next) next();
  }
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
  options: { timeoutMs: number; stdin?: string; stage: "compile" | "run" },
): Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number | null; elapsedMs: number; timedOut: boolean }> {
  const start = Date.now();

  return new Promise((resolve) => {
    let settled = false;
    const env = Object.fromEntries(
      RUNNER_RUNTIME.envAllowlist
        .map((key) => [key, process.env[key]])
        .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );

    const launched = buildLaunchCommand(command, args, options.stage);
    const child = spawn(launched.command, launched.args, {
      stdio: "pipe",
      env: { ...process.env, ...env, MALLOC_ARENA_MAX: "1" },
      detached: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let total = 0;
    let killedForOutput = false;
    let timedOut = false;

    const killTree = () => {
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killTree();
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > RUNNER_LIMITS.outputLimitBytes) {
        killedForOutput = true;
        killTree();
        return;
      }
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > RUNNER_LIMITS.outputLimitBytes) {
        killedForOutput = true;
        killTree();
        return;
      }
      stderrChunks.push(chunk);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const elapsedMs = Date.now() - start;
      const isolationTag = RUNNER_EXECUTION.mode === "isolated" ? ERROR_CODES.RUNNER_ISOLATION_UNAVAILABLE : ERROR_CODES.RUNNER_RUNTIME_FAILED;
      resolve({
        ok: false,
        stdout: "",
        stderr: `[${isolationTag}] ${error.message}`,
        exitCode: null,
        elapsedMs,
        timedOut: false,
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      let stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (killedForOutput) {
        stderr += `\n[${ERROR_CODES.RUNNER_OUTPUT_LIMIT}] output limit exceeded`;
      }
      if (timedOut) {
        stderr += `\n[${ERROR_CODES.RUNNER_EXEC_TIMEOUT}] process timeout`;
      }
      stderr = safeTruncate(stderr, RUNNER_LIMITS.stderrLogLimitBytes);
      const elapsedMs = Date.now() - start;
      const ok = !timedOut && !killedForOutput && code === 0;

      logEvent(ok ? "info" : "warn", "runner.process.finished", {
        stage: options.stage,
        command: launched.command,
        mode: RUNNER_EXECUTION.mode,
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

function buildLaunchCommand(command: string, args: string[], stage: "compile" | "run") {
  if (RUNNER_EXECUTION.mode === "isolated" && RUNNER_EXECUTION.isolatedCommand) {
    const payload = JSON.stringify({ command, args, stage });
    return {
      command: RUNNER_EXECUTION.isolatedCommand,
      args: [payload],
    };
  }

  const applyResourceLimit = stage !== "compile" && HAS_PRLIMIT;
  if (applyResourceLimit) {
    return {
      command: "prlimit",
      args: [`--cpu=${RUNNER_LIMITS.cpuTimeSeconds}`, `--as=${RUNNER_LIMITS.memoryLimitKb * 1024}`, "--", command, ...args],
    };
  }

  return { command, args };
}
