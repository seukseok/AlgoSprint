import { NextResponse } from "next/server";
import { QueueItemStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getQueueMetrics, startJudgeQueueWorker } from "@/lib/queue";

export async function GET() {
  startJudgeQueueWorker();

  const [submissionsByStatus, queueByStatus, queue] = await Promise.all([
    Promise.all(
      Object.values(SubmissionStatus).map(async (status) => ({
        status,
        count: await prisma.submission.count({ where: { status } }),
      })),
    ),
    Promise.all(
      Object.values(QueueItemStatus).map(async (status) => ({
        status,
        count: await prisma.judgeQueueItem.count({ where: { status } }),
      })),
    ),
    getQueueMetrics(),
  ]);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    queueDepth: queue.depth,
    queueLagMs: queue.queueLagMs,
    retryCount: queue.retryCount,
    failureCount: queue.failureCount,
    queueEtaSec: queue.etaSeconds,
    queueMode: queue.mode,
    workerMode: queue.workerMode,
    submissionsByStatus,
    queueByStatus,
  });
}
