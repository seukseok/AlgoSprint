import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueSubmission, getQueueMetrics, getSubmissionQueueState, startJudgeQueueWorker } from "@/lib/queue";
import { requireSessionUser } from "@/lib/session-user";
import { checkRateLimit, getClientIp, rateLimitErrorResponse } from "@/lib/rate-limit";
import { validateSubmitPayload } from "@/lib/validation";
import { createRequestContext, logEvent } from "@/lib/logger";

export async function POST(request: Request) {
  const { requestId, responseHeaders } = createRequestContext(request);

  const session = await requireSessionUser();
  if (session.error) return session.error;

  const ip = getClientIp(request);
  const limited = await checkRateLimit("submit", session.user.id, ip);
  if (limited.limited) {
    return rateLimitErrorResponse("submit", limited.retryAfterSec, { ...limited.headers, ...responseHeaders });
  }

  const payload = validateSubmitPayload(await request.json());
  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: 400, headers: responseHeaders });
  }

  const queued = await prisma.submission.create({
    data: {
      problemId: payload.value.problemId,
      userId: session.user.id,
      source: payload.value.source,
      language: payload.value.language,
      status: "QUEUED",
      output: "채점 대기열에 등록되었습니다.",
    },
  });

  startJudgeQueueWorker();
  await enqueueSubmission(queued.id);

  const [queueState, queueMetrics] = await Promise.all([getSubmissionQueueState(queued.id), getQueueMetrics()]);

  logEvent("info", "judge.submit", {
    requestId,
    submissionId: queued.id,
    problemId: payload.value.problemId,
    userId: session.user.id,
    queueDepth: queueMetrics.depth,
  });

  return NextResponse.json(
    {
      submissionId: queued.id,
      status: queued.status,
      message: queued.output,
      queue: {
        depth: queueMetrics.depth,
        ahead: queueState?.ahead ?? 0,
        estimatedWaitSec: queueState?.estimatedWaitSec ?? queueMetrics.etaSeconds,
      },
    },
    { headers: responseHeaders },
  );
}

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session.error) return session.error;

  const { searchParams } = new URL(request.url);
  const problemId = searchParams.get("problemId");

  const rows = await prisma.submission.findMany({
    where: {
      userId: session.user.id,
      ...(problemId ? { problemId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      problemId: true,
      status: true,
      output: true,
      elapsedMs: true,
      exitCode: true,
      testcaseSummary: true,
      feedbackType: true,
      feedbackRootCause: true,
      feedbackAction: true,
      feedbackMessage: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    items: rows.map((row) => {
      const testcaseSummary = row.testcaseSummary ? JSON.parse(row.testcaseSummary) : [];
      const passedTests = testcaseSummary.filter((item: { passed: boolean }) => item.passed).length;
      const failedIndexes = testcaseSummary.filter((item: { passed: boolean }) => !item.passed).map((item: { index: number }) => item.index);

      return {
        ...row,
        feedback: row.feedbackType
          ? {
              type: row.feedbackType,
              rootCause: row.feedbackRootCause,
              action: row.feedbackAction,
              message: row.feedbackMessage,
            }
          : null,
        stats: {
          totalTests: testcaseSummary.length,
          passedTests,
          failedIndexes,
        },
      };
    }),
  });
}
