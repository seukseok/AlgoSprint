import { spawnSync } from "node:child_process";
import { RUNNER_EXECUTION } from "@/lib/runner-config";

export type RunnerReadiness = {
  mode: "local" | "isolated";
  ready: boolean;
  checks: Record<string, boolean>;
  warnings: string[];
};

export function getRunnerReadiness(): RunnerReadiness {
  if (RUNNER_EXECUTION.mode !== "isolated") {
    return {
      mode: "local",
      ready: true,
      checks: { executionModeConfigured: true },
      warnings: ["Runner is in local mode. Sandbox isolation is disabled."],
    };
  }

  const checks: Record<string, boolean> = {
    isolatedCommandConfigured: Boolean(RUNNER_EXECUTION.isolatedCommand.trim()),
    dockerAvailable: commandOk("docker", ["version"]),
  };

  const warnings: string[] = [];
  if (!checks.isolatedCommandConfigured) warnings.push("RUNNER_ISOLATED_COMMAND is empty.");
  if (!checks.dockerAvailable) warnings.push("Docker is unavailable; isolated wrapper may fall back to local execution.");

  return {
    mode: "isolated",
    ready: Object.values(checks).every(Boolean),
    checks,
    warnings,
  };
}

function commandOk(command: string, args: string[]) {
  try {
    const result = spawnSync(command, args, { stdio: "ignore" });
    return result.status === 0;
  } catch {
    return false;
  }
}
