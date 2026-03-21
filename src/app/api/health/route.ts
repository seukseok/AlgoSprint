import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RUNNER_LIMITS } from "@/lib/runner-config";
import { getQueueDepth, startJudgeQueueWorker } from "@/lib/queue";

export async function GET() {
  startJudgeQueueWorker();

  const checks = {
    database: false,
    queue: false,
    env: Boolean(process.env.DATABASE_URL),
    runnerLimits: RUNNER_LIMITS.maxSourceBytes > 0 && RUNNER_LIMITS.runTimeoutMs > 0 && RUNNER_LIMITS.outputLimitBytes > 0,
  };

  let queueDepth = -1;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
    queueDepth = await getQueueDepth();
    checks.queue = queueDepth >= 0;
  } catch {
    checks.database = false;
    checks.queue = false;
  }

  const ready = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      queueDepth,
      checks,
    },
    { status: ready ? 200 : 503 },
  );
}
