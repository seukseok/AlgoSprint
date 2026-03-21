import { QueueItemStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inferLearningFeedback } from "@/lib/learning-feedback";
import { judgeSubmission } from "@/lib/runner";
import { logEvent } from "@/lib/logger";

let started = false;
let processing = false;

const MAX_RETRIES = 3;

const FINAL_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.ACCEPTED,
  SubmissionStatus.WRONG_ANSWER,
  SubmissionStatus.COMPILATION_ERROR,
  SubmissionStatus.RUNTIME_ERROR,
  SubmissionStatus.TIME_LIMIT_EXCEEDED,
  SubmissionStatus.FAILED,
]);

export function isFinalStatus(status: SubmissionStatus) {
  return FINAL_STATUSES.has(status);
}

export function startJudgeQueueWorker() {
  if (started) return;
  started = true;
  queueMicrotask(() => void recoverAndProcess());
}

export async function enqueueSubmission(submissionId: string) {
  startJudgeQueueWorker();

  await prisma.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submissionId },
      data: { status: SubmissionStatus.QUEUED, output: "채점 대기열에 등록되었습니다." },
    });

    await tx.judgeQueueItem.upsert({
      where: { submissionId },
      create: {
        submissionId,
        status: QueueItemStatus.PENDING,
        maxRetries: MAX_RETRIES,
      },
      update: {
        status: QueueItemStatus.PENDING,
        nextAttemptAt: new Date(),
      },
    });
  });

  logEvent("info", "queue.enqueued", { submissionId });
  queueMicrotask(() => void processNext());
}

export async function getQueueDepth() {
  const [pending, running, retrying] = await Promise.all([
    prisma.judgeQueueItem.count({ where: { status: QueueItemStatus.PENDING } }),
    prisma.judgeQueueItem.count({ where: { status: QueueItemStatus.RUNNING } }),
    prisma.judgeQueueItem.count({ where: { status: QueueItemStatus.RETRYING } }),
  ]);
  return pending + running + retrying;
}

async function recoverAndProcess() {
  await prisma.$transaction(async (tx) => {
    const recovered = await tx.judgeQueueItem.updateMany({
      where: { status: QueueItemStatus.RUNNING },
      data: {
        status: QueueItemStatus.RETRYING,
        nextAttemptAt: new Date(),
        lastError: "프로세스 재시작으로 인해 작업이 복구되었습니다.",
      },
    });

    if (recovered.count > 0) {
      await tx.submission.updateMany({
        where: { status: SubmissionStatus.RUNNING },
        data: {
          status: SubmissionStatus.QUEUED,
          output: "서버 재시작 후 채점을 재개합니다.",
        },
      });
      logEvent("warn", "queue.recovered", { recoveredItems: recovered.count });
    }
  });

  await processNext();
}

async function processNext() {
  if (processing) return;
  processing = true;

  try {
    while (true) {
      const leaseId = crypto.randomUUID();
      const next = await prisma.judgeQueueItem.findFirst({
        where: {
          status: { in: [QueueItemStatus.PENDING, QueueItemStatus.RETRYING] },
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, submissionId: true, attemptCount: true, maxRetries: true },
      });

      if (!next) break;

      const leased = await prisma.judgeQueueItem.updateMany({
        where: {
          id: next.id,
          status: { in: [QueueItemStatus.PENDING, QueueItemStatus.RETRYING] },
        },
        data: {
          status: QueueItemStatus.RUNNING,
          leaseId,
          leaseExpiresAt: new Date(Date.now() + 30_000),
          attemptCount: { increment: 1 },
          startedAt: new Date(),
        },
      });

      if (!leased.count) continue;

      const queueItem = await prisma.judgeQueueItem.findUnique({
        where: { id: next.id },
        select: { attemptCount: true, maxRetries: true, submissionId: true },
      });
      if (!queueItem) continue;

      logEvent("info", "queue.started", {
        submissionId: queueItem.submissionId,
        attemptCount: queueItem.attemptCount,
      });

      await prisma.submission.update({
        where: { id: queueItem.submissionId },
        data: {
          status: SubmissionStatus.RUNNING,
          output: `채점 중입니다... (시도 ${queueItem.attemptCount}/${queueItem.maxRetries})`,
        },
      });

      try {
        await processSubmission(queueItem.submissionId);
        await prisma.judgeQueueItem.update({
          where: { id: next.id },
          data: { status: QueueItemStatus.COMPLETED, completedAt: new Date(), leaseId: null, leaseExpiresAt: null },
        });

        logEvent("info", "queue.completed", { submissionId: queueItem.submissionId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 채점 실패";
        const shouldRetry = queueItem.attemptCount < queueItem.maxRetries;

        if (shouldRetry) {
          await prisma.$transaction(async (tx) => {
            await tx.judgeQueueItem.update({
              where: { id: next.id },
              data: {
                status: QueueItemStatus.RETRYING,
                nextAttemptAt: new Date(Date.now() + backoffMs(queueItem.attemptCount)),
                lastError: message,
                leaseId: null,
                leaseExpiresAt: null,
              },
            });

            await tx.submission.update({
              where: { id: queueItem.submissionId },
              data: {
                status: SubmissionStatus.QUEUED,
                output: "채점 중 오류가 발생해 자동 재시도합니다.",
              },
            });
          });

          logEvent("warn", "queue.retrying", {
            submissionId: queueItem.submissionId,
            attemptCount: queueItem.attemptCount,
            error: message,
          });
        } else {
          await prisma.$transaction(async (tx) => {
            await tx.judgeQueueItem.update({
              where: { id: next.id },
              data: {
                status: QueueItemStatus.FAILED,
                lastError: message,
                completedAt: new Date(),
                leaseId: null,
                leaseExpiresAt: null,
              },
            });

            await tx.submission.update({
              where: { id: queueItem.submissionId },
              data: {
                status: SubmissionStatus.FAILED,
                output: "채점 시스템 오류로 제출 처리에 실패했습니다. 잠시 후 다시 제출해 주세요.",
                verdictReadyAt: new Date(),
              },
            });
          });

          logEvent("error", "queue.failed", {
            submissionId: queueItem.submissionId,
            attemptCount: queueItem.attemptCount,
            error: message,
          });
        }
      }
    }
  } finally {
    processing = false;
  }
}

async function processSubmission(submissionId: string) {
  const next = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, source: true, problemId: true, userId: true },
  });

  if (!next) {
    throw new Error("제출 데이터를 찾을 수 없습니다.");
  }

  const judged = await judgeSubmission(next.problemId, next.source);
  const [problem, recent] = await Promise.all([
    prisma.problem.findUnique({ where: { id: next.problemId }, select: { tags: true } }),
    prisma.submission.findMany({
      where: {
        userId: next.userId,
        problemId: next.problemId,
        status: {
          in: [
            SubmissionStatus.WRONG_ANSWER,
            SubmissionStatus.RUNTIME_ERROR,
            SubmissionStatus.TIME_LIMIT_EXCEEDED,
            SubmissionStatus.COMPILATION_ERROR,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { status: true },
    }),
  ]);

  const feedback = inferLearningFeedback({
    status: judged.status,
    output: judged.output,
    testcaseSummary: judged.summary,
    recentStatuses: recent.map((item) => item.status),
  });

  const tags = safelyParseTags(problem?.tags);

  await prisma.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: next.id },
      data: {
        status: judged.status,
        output: judged.output,
        testcaseSummary: JSON.stringify(judged.summary),
        elapsedMs: judged.elapsedMs,
        exitCode: judged.exitCode,
        verdictReadyAt: new Date(),
        feedbackType: feedback.failureType,
        feedbackRootCause: feedback.rootCauseCategory,
        feedbackAction: feedback.action,
        feedbackMessage: feedback.message,
      },
    });

    const failed = judged.status !== SubmissionStatus.ACCEPTED;
    const delta = failed ? 2 : -1;

    await tx.userProblemWeakness.upsert({
      where: { userId_problemId: { userId: next.userId, problemId: next.problemId } },
      create: {
        userId: next.userId,
        problemId: next.problemId,
        weaknessScore: failed ? 2 : 0,
        failCount: failed ? 1 : 0,
        lastStatus: judged.status,
        lastFeedbackAction: feedback.action,
        lastFailedAt: failed ? new Date() : null,
      },
      update: {
        weaknessScore: { increment: delta },
        failCount: failed ? { increment: 1 } : undefined,
        lastStatus: judged.status,
        lastFeedbackAction: feedback.action,
        lastFailedAt: failed ? new Date() : undefined,
      },
    });

    for (const topic of tags) {
      await tx.userTopicWeakness.upsert({
        where: { userId_topic: { userId: next.userId, topic } },
        create: {
          userId: next.userId,
          topic,
          weaknessScore: failed ? 2 : 0,
          failCount: failed ? 1 : 0,
          lastStatus: judged.status,
          lastFailedAt: failed ? new Date() : null,
        },
        update: {
          weaknessScore: { increment: delta },
          failCount: failed ? { increment: 1 } : undefined,
          lastStatus: judged.status,
          lastFailedAt: failed ? new Date() : undefined,
        },
      });
    }

    await tx.userProblemWeakness.updateMany({
      where: { userId: next.userId, weaknessScore: { lt: 0 } },
      data: { weaknessScore: 0 },
    });
    await tx.userTopicWeakness.updateMany({
      where: { userId: next.userId, weaknessScore: { lt: 0 } },
      data: { weaknessScore: 0 },
    });
  });
}

function safelyParseTags(raw: string | null | undefined) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function backoffMs(attemptCount: number) {
  return Math.min(20_000, 1_500 * 2 ** Math.max(0, attemptCount - 1));
}
