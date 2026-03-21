import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFinalStatus } from "@/lib/queue";
import { requireSessionUser } from "@/lib/session-user";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionUser();
  if (session.error) return session.error;

  const { id } = await params;
  const submission = await prisma.submission.findUnique({ where: { id } });

  if (!submission || submission.userId !== session.user.id) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  await prisma.submission.update({
    where: { id },
    data: { polledCount: { increment: 1 } },
  });

  const done = isFinalStatus(submission.status);

  const testcaseSummary = submission.testcaseSummary ? JSON.parse(submission.testcaseSummary) : [];
  const passedTests = testcaseSummary.filter((item: { passed: boolean }) => item.passed).length;
  const failedIndexes = testcaseSummary.filter((item: { passed: boolean }) => !item.passed).map((item: { index: number }) => item.index);

  return NextResponse.json({
    id: submission.id,
    status: submission.status,
    done,
    output: submission.output,
    elapsedMs: submission.elapsedMs,
    exitCode: submission.exitCode,
    testcaseSummary,
    stats: {
      totalTests: testcaseSummary.length,
      passedTests,
      failedIndexes,
    },
  });
}
