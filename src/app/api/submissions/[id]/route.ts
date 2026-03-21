import { NextResponse } from "next/server";
import { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const FINAL_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.ACCEPTED,
  SubmissionStatus.WRONG_ANSWER,
  SubmissionStatus.COMPILATION_ERROR,
  SubmissionStatus.RUNTIME_ERROR,
  SubmissionStatus.TIME_LIMIT_EXCEEDED,
]);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await prisma.submission.findUnique({ where: { id } });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const done = FINAL_STATUSES.has(submission.status);

  return NextResponse.json({
    id: submission.id,
    status: submission.status,
    done,
    output: submission.output,
    elapsedMs: submission.elapsedMs,
    exitCode: submission.exitCode,
    testcaseSummary: submission.testcaseSummary ? JSON.parse(submission.testcaseSummary) : [],
  });
}
