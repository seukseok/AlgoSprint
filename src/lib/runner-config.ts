import { RUNNER_SAFETY_POLICY } from "@/lib/runner-safety-policy";

export const RUNNER_LIMITS = RUNNER_SAFETY_POLICY.limits;
export const RUNNER_DENYLIST_PATTERNS = RUNNER_SAFETY_POLICY.denylistPatterns;
export const RUNNER_COMPILER = RUNNER_SAFETY_POLICY.compiler;
export const RUNNER_RUNTIME = RUNNER_SAFETY_POLICY.runtime;
