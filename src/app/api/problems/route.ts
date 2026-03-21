import { NextResponse } from "next/server";
import { getProblems } from "@/lib/problems";

export async function GET() {
  const problems = await getProblems();
  return NextResponse.json({ problems });
}
