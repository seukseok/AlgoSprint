import { NextResponse } from "next/server";
import { isAdminEmail, requireSessionUser } from "@/lib/session-user";
import { listDeadLetters, requeueDeadLetter } from "@/lib/queue";

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session.error) return session.error;
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const rows = await listDeadLetters(limit);
  return NextResponse.json({ items: rows, count: rows.length });
}

type RequeueBody = { submissionId?: string };

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session.error) return session.error;
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as RequeueBody;
  const submissionId = body.submissionId?.trim();
  if (!submissionId) {
    return NextResponse.json({ error: "submissionId required" }, { status: 400 });
  }

  const result = await requeueDeadLetter(submissionId);
  if (!result.ok) {
    return NextResponse.json({ error: "Dead-letter item not found", code: result.code }, { status: 404 });
  }

  return NextResponse.json({ ok: true, submissionId });
}
