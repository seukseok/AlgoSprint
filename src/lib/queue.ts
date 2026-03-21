import { QueueItemStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inferLearningFeedback } from "@/lib/learning-feedback";
import { judgeSubmission } from "@/lib/runner";
import { logEvent } from "@/lib/logger";
import { getRedisClient, redisMode } from "@/lib/redis";
import { ERROR_CODES } from "@/lib/error-codes";

let started = false;
let processing = false;
let runPromise: Promise<{ processed: number }> | null = null;

const MAX_RETRIES = 3;
const REDIS_QUEUE_KEY = "judge:queue:ready";
const REDIS_LEASE_PREFIX = "judge:lease:";
const REDIS_WORKER_LOCK = "judge:worker:lock";

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

export function shouldAutoStartWorker() {
  return process.env.QUEUE_WORKER_MODE !== "external";
}

export function startJudgeQueueWorker() {
  if (!shouldAutoStartWorker()) return;
  if (started) return;
  started = true;
  queueMicrotask(() => void recoverAndProcess());
}

export async function enqueueSubmission(submissionId: string) {
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
        deadLetteredAt: null,
        deadLetterReason: null,
      },
    });
  });

  await enqueueRedisReady(submissionId);
  logEvent("info", "queue.enqueued", { submissionId, mode: redisMode() });
  if (shouldAutoStartWorker()) queueMicrotask(() => void processNext());
}

export async function getQueueDepth() {
  const [pending, running, retrying] = await Promise.all([
    prisma.judgeQueueItem.count({ where: { status: QueueItemStatus.PENDING } }),
    prisma.judgeQueueItem.count({ where: { status: QueueItemStatus.RUNNING } }),
    prisma.judgeQueueItem.count({ where: { status: QueueItemStatus.RETRYING } }),
  ]);
  return pending + running + retrying;
}

export async function getQueueMetrics() {
  const now = new Date();
  const [depth, retryCount, failureCount, deadLetterCount, oldestPending] = await Promise.all([
    getQueueDepth(),
    prisma.judgeQueueItem.count({ where: { status: QueueItemStatus.RETRYING } }),
    prisma.judgeQueueItem.count({ where: { status: QueueItemStatus.FAILED } }),
    prisma.judgeQueueItem.count({ where: { status: QueueItemStatus.DEAD_LETTER } }),
    prisma.judgeQueueItem.findFirst({
      where: { status: { in: [QueueItemStatus.PENDING, QueueItemStatus.RETRYING] }, nextAttemptAt: { lte: now } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const queueLagMs = oldestPending ? Math.max(0, now.getTime() - oldestPending.createdAt.getTime()) : 0;
  const avgWaitSec = Math.max(2, Number(process.env.QUEUE_AVG_JOB_SECONDS ?? "6"));

  return {
    depth,
    retryCount,
    failureCount,
    deadLetterCount,
    queueLagMs,
    etaSeconds: depth * avgWaitSec,
    mode: redisMode(),
    workerMode: process.env.QUEUE_WORKER_MODE ?? "embedded",
  };
}

export async function getQueueSloSummary() {
  const windowHours = Math.max(1, Number(process.env.SLO_WINDOW_HOURS ?? "24"));
  const since = new Date(Date.now() - windowHours * 3600_000);
  const done = await prisma.submission.findMany({
    where: {
      verdictReadyAt: { not: null, gte: since },
      status: { in: Array.from(FINAL_STATUSES) },
    },
    select: { status: true, createdAt: true, verdictReadyAt: true, elapsedMs: true },
    take: 1500,
    orderBy: { verdictReadyAt: "desc" },
  });

  const total = done.length;
  const success = done.filter((item) => item.status === SubmissionStatus.ACCEPTED).length;
  const processing = done.map((item) => item.elapsedMs ?? 0).filter((v) => v > 0);
  const queueDelay = done
    .map((item) => (item.verdictReadyAt ? Math.max(0, item.verdictReadyAt.getTime() - item.createdAt.getTime() - (item.elapsedMs ?? 0)) : 0))
    .filter((v) => v >= 0);

  return {
    windowHours,
    sampleSize: total,
    successRate: total ? Number(((success / total) * 100).toFixed(2)) : 0,
    processingP95Ms: percentile(processing, 95),
    queueDelayP50Ms: percentile(queueDelay, 50),
    queueDelayP95Ms: percentile(queueDelay, 95),
  };
}

export async function listDeadLetters(limit = 50) {
  return prisma.judgeQueueItem.findMany({
    where: { status: QueueItemStatus.DEAD_LETTER },
    take: Math.max(1, Math.min(200, limit)),
    orderBy: { deadLetteredAt: "desc" },
    include: {
      submission: {
        select: { id: true, userId: true, problemId: true, status: true, output: true, createdAt: true },
      },
    },
  });
}

export async function requeueDeadLetter(submissionId: string) {
  const item = await prisma.judgeQueueItem.findUnique({ where: { submissionId } });
  if (!item || item.status !== QueueItemStatus.DEAD_LETTER) {
    return { ok: false as const, code: ERROR_CODES.QUEUE_ITEM_NOT_FOUND };
  }

  await prisma.$transaction(async (tx) => {
    await tx.judgeQueueItem.update({
      where: { submissionId },
      data: {
        status: QueueItemStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        deadLetteredAt: null,
        deadLetterReason: null,
        completedAt: null,
      },
    });
    await tx.submission.update({
      where: { id: submissionId },
      data: { status: SubmissionStatus.QUEUED, output: "관리자에 의해 재큐잉되었습니다." },
    });
  });

  await enqueueRedisReady(submissionId);
  return { ok: true as const };
}

export async function getSubmissionQueueState(submissionId: string) {
  const item = await prisma.judgeQueueItem.findUnique({
    where: { submissionId },
    select: { status: true, createdAt: true },
  });
  if (!item) return null;

  const ahead = await prisma.judgeQueueItem.count({
    where: {
      status: { in: [QueueItemStatus.PENDING, QueueItemStatus.RETRYING] },
      createdAt: { lt: item.createdAt },
    },
  });

  const avgWaitSec = Math.max(2, Number(process.env.QUEUE_AVG_JOB_SECONDS ?? "6"));
  return {
    status: item.status,
    ahead,
    estimatedWaitSec: Math.max(0, ahead * avgWaitSec),
  };
}

export async function runWorkerLoop() {
  if (runPromise) return runPromise;
  runPromise = recoverAndProcess().finally(() => {
    runPromise = null;
  });
  return runPromise;
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

  await hydrateRedisQueueFromDb();
  const processed = await processNext();
  return { processed };
}

async function processNext() {
  if (processing) return 0;
  if (!(await tryAcquireWorkerLock())) return 0;
  processing = true;
  let processed = 0;

  try {
    while (true) {
      const leased = await leaseNextItem();
      if (!leased) break;

      const queueItem = await prisma.judgeQueueItem.findUnique({
        where: { id: leased.id },
        select: { attemptCount: true, maxRetries: true, submissionId: true },
      });
      if (!queueItem) {
        await releaseLease(leased);
        continue;
      }

      logEvent("info", "queue.started", {
        submissionId: queueItem.submissionId,
        attemptCount: queueItem.attemptCount,
        requestId: leased.leaseId,
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
          where: { id: leased.id },
          data: { status: QueueItemStatus.COMPLETED, completedAt: new Date(), leaseId: null, leaseExpiresAt: null },
        });
        await releaseLease(leased);
        processed += 1;
        logEvent("info", "queue.completed", { submissionId: queueItem.submissionId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 채점 실패";
        const shouldRetry = queueItem.attemptCount < queueItem.maxRetries;

        if (shouldRetry) {
          const delayMs = backoffMs(queueItem.attemptCount);
          await prisma.$transaction(async (tx) => {
            await tx.judgeQueueItem.update({
              where: { id: leased.id },
              data: {
                status: QueueItemStatus.RETRYING,
                nextAttemptAt: new Date(Date.now() + delayMs),
                lastError: `${ERROR_CODES.QUEUE_PROCESSING_FAILED}: ${message}`,
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

          await enqueueRedisReady(queueItem.submissionId, Date.now() + delayMs);
          await releaseLease(leased);
          logEvent("warn", "queue.retrying", {
            submissionId: queueItem.submissionId,
            attemptCount: queueItem.attemptCount,
            error: message,
          });
        } else {
          await prisma.$transaction(async (tx) => {
            await tx.judgeQueueItem.update({
              where: { id: leased.id },
              data: {
                status: QueueItemStatus.DEAD_LETTER,
                deadLetteredAt: new Date(),
                deadLetterReason: `${ERROR_CODES.QUEUE_PROCESSING_FAILED}: ${message}`,
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
                output: "채점 시스템 오류로 제출 처리에 실패했습니다. 관리자 재처리가 필요합니다.",
                verdictReadyAt: new Date(),
              },
            });
          });

          await releaseLease(leased);
          logEvent("error", "queue.dead_letter", {
            submissionId: queueItem.submissionId,
            attemptCount: queueItem.attemptCount,
            error: message,
          });
        }
      }
    }
  } finally {
    processing = false;
    await releaseWorkerLock();
  }

  return processed;
}

async function leaseNextItem() {
  const leaseId = crypto.randomUUID();
  const redis = getRedisClient();

  if (redis) {
    const now = Date.now();
    const submissionId = await redis.zrangebyscore(REDIS_QUEUE_KEY, 0, now, "LIMIT", 0, 1).then(async (rows) => {
      if (!rows.length) return null;
      const candidate = rows[0];
      const removed = await redis.zrem(REDIS_QUEUE_KEY, candidate);
      if (!removed) return null;
      await redis.set(`${REDIS_LEASE_PREFIX}${candidate}`, leaseId, "PX", 30_000);
      return candidate;
    });

    if (submissionId) {
      const dbItem = await prisma.judgeQueueItem.findUnique({
        where: { submissionId },
        select: { id: true },
      });
      if (dbItem) {
        const ok = await prisma.judgeQueueItem.updateMany({
          where: { id: dbItem.id, status: { in: [QueueItemStatus.PENDING, QueueItemStatus.RETRYING] } },
          data: {
            status: QueueItemStatus.RUNNING,
            leaseId,
            leaseExpiresAt: new Date(Date.now() + 30_000),
            attemptCount: { increment: 1 },
            startedAt: new Date(),
          },
        });
        if (ok.count) return { id: dbItem.id, submissionId, leaseId };
      }
      await releaseLease({ submissionId, leaseId, id: "" });
    }
  }

  const next = await prisma.judgeQueueItem.findFirst({
    where: {
      status: { in: [QueueItemStatus.PENDING, QueueItemStatus.RETRYING] },
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, submissionId: true },
  });
  if (!next) return null;

  const leased = await prisma.judgeQueueItem.updateMany({
    where: { id: next.id, status: { in: [QueueItemStatus.PENDING, QueueItemStatus.RETRYING] } },
    data: {
      status: QueueItemStatus.RUNNING,
      leaseId,
      leaseExpiresAt: new Date(Date.now() + 30_000),
      attemptCount: { increment: 1 },
      startedAt: new Date(),
    },
  });

  if (!leased.count) return null;
  return { id: next.id, submissionId: next.submissionId, leaseId };
}

async function enqueueRedisReady(submissionId: string, dueAtMs = Date.now()) {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.zadd(REDIS_QUEUE_KEY, `${dueAtMs}`, submissionId);
}

async function releaseLease(leased: { submissionId: string; leaseId: string; id: string }) {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.del(`${REDIS_LEASE_PREFIX}${leased.submissionId}`);
}

async function tryAcquireWorkerLock() {
  const redis = getRedisClient();
  if (!redis) return true;
  const lockValue = `${process.pid}:${Date.now()}`;
  const ok = await redis.set(REDIS_WORKER_LOCK, lockValue, "PX", 25_000, "NX");
  return ok === "OK";
}

async function releaseWorkerLock() {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.del(REDIS_WORKER_LOCK);
}

async function hydrateRedisQueueFromDb() {
  const redis = getRedisClient();
  if (!redis) return;

  const pending = await prisma.judgeQueueItem.findMany({
    where: { status: { in: [QueueItemStatus.PENDING, QueueItemStatus.RETRYING] } },
    select: { submissionId: true, nextAttemptAt: true },
    take: 500,
  });
  if (!pending.length) return;

  const zargs: string[] = [];
  for (const row of pending) {
    zargs.push(`${row.nextAttemptAt.getTime()}`, row.submissionId);
  }
  await redis.zadd(REDIS_QUEUE_KEY, ...zargs);
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

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}
