export const RUNNER_SAFETY_POLICY = {
  limits: {
    compileTimeoutMs: 8_000,
    runTimeoutMs: 2_000,
    outputLimitBytes: 64 * 1024,
    stderrLogLimitBytes: 8 * 1024,
    maxSourceBytes: 128 * 1024,
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
