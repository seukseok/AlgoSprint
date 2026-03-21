export const RUNNER_SAFETY_POLICY = {
  execution: {
    mode: (process.env.RUNNER_EXECUTION_MODE ?? "local") as "local" | "isolated",
    isolatedCommand: process.env.RUNNER_ISOLATED_COMMAND ?? "",
  },
  limits: {
    compileTimeoutMs: 8_000,
    runTimeoutMs: 2_000,
    outputLimitBytes: 64 * 1024,
    stderrLogLimitBytes: 8 * 1024,
    maxSourceBytes: 128 * 1024,
    cpuTimeSeconds: Math.max(1, Number(process.env.RUNNER_CPU_TIME_SECONDS ?? "2")),
    memoryLimitKb: Math.max(64 * 1024, Number(process.env.RUNNER_MEMORY_LIMIT_KB ?? "262144")),
  },
  compiler: {
    command: "g++",
    args: ["-std=c++17", "-O2", "-pipe", "-fstack-protector-strong", "-D_FORTIFY_SOURCE=2"],
  },
  runtime: {
    envAllowlist: ["PATH"],
  },
  denylistPatterns: [
    /#include\s*<sys\/socket\.h>/,
    /#include\s*<netinet\/in\.h>/,
    /#include\s*<arpa\/inet\.h>/,
    /#include\s*<unistd\.h>/,
    /\bsystem\s*\(/,
    /\bpopen\s*\(/,
    /\bfork\s*\(/,
    /\bexec[a-z]*\s*\(/,
    /\bkill\s*\(/,
    /\bptrace\s*\(/,
    /\bstd::filesystem\b/,
    /\bfstream\b/,
  ],
} as const;
