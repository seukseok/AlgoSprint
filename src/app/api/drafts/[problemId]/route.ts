import { NextResponse } from "next/server";
import { getMockUser } from "@/lib/data";
import { prisma } from "@/lib/prisma";

type DraftUpdateRequest = {
  code: string;
};

export async function GET(_: Request, { params }: { params: Promise<{ problemId: string }> }) {
  const { problemId } = await params;
  const user = await getMockUser();

  const draft = await prisma.codeDraft.findUnique({
    where: {
      userId_problemId: {
        userId: user.id,
        problemId,
      },
    },
  });

  return NextResponse.json({ code: draft?.code ?? null });
}

export async function PUT(request: Request, { params }: { params: Promise<{ problemId: string }> }) {
  const { problemId } = await params;
  const body = (await request.json()) as DraftUpdateRequest;
  if (typeof body?.code !== "string") {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const user = await getMockUser();
  const draft = await prisma.codeDraft.upsert({
    where: {
      userId_problemId: {
        userId: user.id,
        problemId,
      },
    },
    update: {
      code: body.code,
    },
    create: {
      code: body.code,
      userId: user.id,
      problemId,
    },
  });

  return NextResponse.json({ code: draft.code, updatedAt: draft.updatedAt });
}
