import { NextResponse } from "next/server";
import { findProblem } from "@/lib/problems";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = await findProblem(id);

  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  return NextResponse.json({ problem });
}
