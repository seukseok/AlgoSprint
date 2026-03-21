import { NextResponse } from "next/server";
import { SubmissionStatus } from "@prisma/client";
import { getMockUser } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { judgeSubmission } from "@/lib/runner";

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

  const queued = await prisma.submission.create({
    data: {
      problemId: body.problemId,
      userId: user.id,
      source: body.source,
      language: body.language ?? "cpp17",
      status: SubmissionStatus.RUNNING,
      output: "Judging in progress...",
    },
  });

  const judged = await judgeSubmission(body.problemId, body.source);

  const submission = await prisma.submission.update({
    where: { id: queued.id },
    data: {
      status: judged.status as SubmissionStatus,
      output: judged.output,
      testcaseSummary: JSON.stringify(judged.summary),
      elapsedMs: judged.elapsedMs,
      exitCode: judged.exitCode,
      verdictReadyAt: new Date(),
    },
  });

  return NextResponse.json({
    submissionId: submission.id,
    status: submission.status,
    message: submission.output,
    testcaseSummary: judged.summary,
    elapsedMs: judged.elapsedMs,
  });
}

export async function GET(request: Request) {
  const user = await getMockUser();
  const { searchParams } = new URL(request.url);
  const problemId = searchParams.get("problemId");

  const rows = await prisma.submission.findMany({
    where: {
      userId: user.id,
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
      createdAt: true,
    },
  });

  return NextResponse.json({
    items: rows.map((row) => ({
      ...row,
      testcaseSummary: row.testcaseSummary ? JSON.parse(row.testcaseSummary) : [],
    })),
  });
}
