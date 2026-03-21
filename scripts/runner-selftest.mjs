#!/usr/bin/env node
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const mode = process.env.RUNNER_EXECUTION_MODE ?? "local";
const isolatedCommand = process.env.RUNNER_ISOLATED_COMMAND ?? "";

const workspace = await mkdtemp(path.join(os.tmpdir(), "algosprint-selftest-"));
const sourcePath = path.join(workspace, "main.cpp");
const binaryPath = path.join(workspace, "main.out");

const code = `#include <bits/stdc++.h>\nusing namespace std;\nint main(){ios::sync_with_stdio(false);cin.tie(nullptr); long long a,b; if(!(cin>>a>>b)) return 0; cout << (a+b) << "\\n"; return 0;}`;

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function run(command, args = [], stdin = "") {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

try {
  await writeFile(sourcePath, code, "utf8");

  let compile;
  if (mode === "isolated" && isolatedCommand.trim()) {
    const payload = JSON.stringify({ command: "g++", args: ["-std=c++17", "-O2", "-pipe", sourcePath, "-o", binaryPath], stage: "compile" });
    compile = await run("bash", ["-lc", `${isolatedCommand} ${shellQuote(payload)}`]);
  } else {
    compile = await run("g++", ["-std=c++17", "-O2", "-pipe", sourcePath, "-o", binaryPath]);
  }

  if (compile.code !== 0) {
    console.error("[selftest] compile failed");
    process.stderr.write(compile.stderr);
    process.exit(1);
  }

  let runResult;
  if (mode === "isolated" && isolatedCommand.trim()) {
    const payload = JSON.stringify({ command: binaryPath, args: [], stage: "run" });
    runResult = await run("bash", ["-lc", `${isolatedCommand} ${shellQuote(payload)}`], "20 22\n");
  } else {
    runResult = await run(binaryPath, [], "20 22\n");
  }

  if (runResult.code !== 0) {
    console.error("[selftest] run failed");
    process.stderr.write(runResult.stderr);
    process.exit(1);
  }

  const output = runResult.stdout.trim();
  if (output !== "42") {
    console.error(`[selftest] unexpected output: ${output}`);
    process.exit(1);
  }

  console.log(`[selftest] ok mode=${mode}`);
  if (mode === "isolated" && runResult.stderr.includes("docker unavailable")) {
    console.warn("[selftest] warning: docker unavailable; fallback path was used");
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
