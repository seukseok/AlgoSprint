import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueSubmission } from "@/lib/queue";
import { requireSessionUser, isAdminEmail } from "@/lib/session-user";

type QueueTestRequest = { problemId?: string };

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session.error) return session.error;
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as QueueTestRequest;
  const problemId = body.problemId ?? "two-sum";

  const problem = await prisma.problem.findUnique({ where: { id: problemId } });
  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  const submission = await prisma.submission.create({
    data: {
      userId: session.user.id,
      problemId,
      source: problem.starterCode,
      language: "cpp17",
      status: "QUEUED",
      output: "Queued from admin harness...",
    },
  });

  await enqueueSubmission(submission.id);

  return NextResponse.json({
    submissionId: submission.id,
    status: submission.status,
    message: submission.output,
    problemId,
  });
}
