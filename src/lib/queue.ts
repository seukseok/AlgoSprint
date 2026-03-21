import { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inferLearningFeedback } from "@/lib/learning-feedback";
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
        select: { id: true, source: true, problemId: true, userId: true },
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
  } finally {
    processing = false;
  }
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
