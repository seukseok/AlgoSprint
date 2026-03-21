import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueSubmission } from "@/lib/queue";
import { requireSessionUser } from "@/lib/session-user";

type SubmitRequest = {
  problemId: string;
  source: string;
  language?: string;
};

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session.error) return session.error;

  const body = (await request.json()) as SubmitRequest;

  if (!body?.problemId || !body.source) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const queued = await prisma.submission.create({
    data: {
      problemId: body.problemId,
      userId: session.user.id,
      source: body.source,
      language: body.language ?? "cpp17",
      status: "QUEUED",
      output: "Queued for judging...",
    },
  });

  await enqueueSubmission(queued.id);

  return NextResponse.json({
    submissionId: queued.id,
    status: queued.status,
    message: queued.output,
  });
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
        testcaseSummary,
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
