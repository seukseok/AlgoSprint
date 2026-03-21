import { NextResponse } from "next/server";
import { SubmissionStatus } from "@prisma/client";
import { getMockUser } from "@/lib/data";
import { prisma } from "@/lib/prisma";

type SubmitRequest = {
  problemId: string;
  source: string;
  language?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SubmitRequest;

  if (!body?.problemId || !body.source) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const user = await getMockUser();
  const submission = await prisma.submission.create({
    data: {
      problemId: body.problemId,
      userId: user.id,
      source: body.source,
      language: body.language ?? "cpp17",
      status: SubmissionStatus.QUEUED,
      verdictReadyAt: new Date(Date.now() + 4500),
      output: "Submission queued. Verdict pending...",
    },
  });

  return NextResponse.json({
    submissionId: submission.id,
    status: submission.status,
    message: submission.output,
  });
}
