import { NextResponse } from "next/server";
import { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const FINAL_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.ACCEPTED,
  SubmissionStatus.WRONG_ANSWER,
  SubmissionStatus.RUNTIME_ERROR,
]);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await prisma.submission.findUnique({ where: { id } });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (!FINAL_STATUSES.has(submission.status)) {
    const now = new Date();
    const shouldFinalize = submission.verdictReadyAt && submission.verdictReadyAt <= now;

    const nextStatus = shouldFinalize
      ? submission.source.includes("return 0")
        ? SubmissionStatus.ACCEPTED
        : SubmissionStatus.WRONG_ANSWER
      : submission.status === SubmissionStatus.QUEUED
        ? SubmissionStatus.RUNNING
        : SubmissionStatus.RUNNING;

    const nextOutput =
      nextStatus === SubmissionStatus.RUNNING
        ? "Judging in progress..."
        : nextStatus === SubmissionStatus.ACCEPTED
          ? "Accepted (simulated)."
          : "Wrong Answer (simulated).";

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: nextStatus,
        output: nextOutput,
        polledCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      done: FINAL_STATUSES.has(updated.status),
      output: updated.output,
    });
  }

  return NextResponse.json({
    id: submission.id,
    status: submission.status,
    done: true,
    output: submission.output,
  });
}
