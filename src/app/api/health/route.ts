import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RUNNER_LIMITS } from "@/lib/runner-config";

export async function GET() {
  const checks = {
    database: false,
    env: Boolean(process.env.DATABASE_URL),
    runnerLimits: RUNNER_LIMITS.maxSourceBytes > 0 && RUNNER_LIMITS.runTimeoutMs > 0 && RUNNER_LIMITS.outputLimitBytes > 0,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const ready = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: ready ? 200 : 503 },
  );
}
