import { NextResponse } from "next/server";
import { runWorkerLoop } from "@/lib/queue";

export async function POST(request: Request) {
  const configured = process.env.WORKER_API_TOKEN;
  if (configured) {
    const token = request.headers.get("x-worker-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token || token !== configured) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await runWorkerLoop();
  return NextResponse.json({ ok: true, mode: process.env.QUEUE_WORKER_MODE ?? "embedded" });
}
