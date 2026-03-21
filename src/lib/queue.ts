import { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { judgeSubmission } from "@/lib/runner";

let started = false;
let processing = false;

const FINAL_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.ACCEPTED,
  SubmissionStatus.WRONG_ANSWER,
  SubmissionStatus.COMPILATION_ERROR,
  SubmissionStatus.RUNTIME_ERROR,
  SubmissionStatus.TIME_LIMIT_EXCEEDED,
]);

export function isFinalStatus(status: SubmissionStatus) {
  return FINAL_STATUSES.has(status);
}

export function startJudgeQueueWorker() {
  if (started) return;
  started = true;
  queueMicrotask(() => void processNext());
}

export async function enqueueSubmission(submissionId: string) {
  startJudgeQueueWorker();
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: SubmissionStatus.QUEUED, output: "Queued for judging..." },
  });
  queueMicrotask(() => void processNext());
}

async function processNext() {
  if (processing) return;
  processing = true;

  try {
    while (true) {
      const next = await prisma.submission.findFirst({
        where: { status: SubmissionStatus.QUEUED },
        orderBy: { createdAt: "asc" },
        select: { id: true, source: true, problemId: true },
      });

      if (!next) break;

      await prisma.submission.update({
        where: { id: next.id },
        data: {
          status: SubmissionStatus.RUNNING,
          output: "Judging in progress...",
        },
      });

      const judged = await judgeSubmission(next.problemId, next.source);

      await prisma.submission.update({
        where: { id: next.id },
        data: {
          status: judged.status,
          output: judged.output,
          testcaseSummary: JSON.stringify(judged.summary),
          elapsedMs: judged.elapsedMs,
          exitCode: judged.exitCode,
          verdictReadyAt: new Date(),
        },
      });
    }
  } finally {
    processing = false;
  }
}
