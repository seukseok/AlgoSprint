import { NextResponse } from "next/server";
import { QueueItemStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getQueueDepth, startJudgeQueueWorker } from "@/lib/queue";

export async function GET() {
  startJudgeQueueWorker();

  const [submissionsByStatus, queueByStatus, queueDepth] = await Promise.all([
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
    getQueueDepth(),
  ]);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    queueDepth,
    submissionsByStatus,
    queueByStatus,
  });
}
