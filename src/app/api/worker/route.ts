import { NextResponse } from "next/server";
import { runWorkerLoop } from "@/lib/queue";
import { verifyWorkerRequest } from "@/lib/worker-auth";

export async function POST(request: Request) {
  const verified = await verifyWorkerRequest(request);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.message, code: verified.code }, { status: verified.status });
  }

  const result = await runWorkerLoop();
  return NextResponse.json({ ok: true, mode: process.env.QUEUE_WORKER_MODE ?? "embedded", ...result });
}
