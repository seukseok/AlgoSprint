"use client";

import { useState } from "react";

type QueueResponse = { submissionId: string; status: string; message: string; problemId: string };

export function HarnessClient() {
  const [problemId, setProblemId] = useState("two-sum");
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  async function trigger() {
    setRunning(true);
    setStatusLog(["Creating queued submission..."]);

    const res = await fetch("/api/admin/queue-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId }),
    });

    if (!res.ok) {
      setStatusLog((prev) => [...prev, `Failed to create queue test (${res.status})`]);
      setRunning(false);
      return;
    }

    const data = (await res.json()) as QueueResponse;
    setStatusLog((prev) => [...prev, `Submission ${data.submissionId} queued (${data.status})`]);

    for (let i = 0; i < 15; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const poll = await fetch(`/api/submissions/${data.submissionId}`, { cache: "no-store" });
      if (!poll.ok) {
        setStatusLog((prev) => [...prev, `Poll failed (${poll.status})`]);
        break;
      }
      const row = (await poll.json()) as { status: string; done: boolean; output: string };
      setStatusLog((prev) => [...prev, `#${i + 1}: ${row.status}`]);
      if (row.done) {
        setStatusLog((prev) => [...prev, `Final: ${row.status} - ${row.output}`]);
        break;
      }
    }

    setRunning(false);
  }

  return (
    <section className="space-y-3 rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={problemId}
          onChange={(e) => setProblemId(e.target.value)}
          className="rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
          placeholder="problem id"
        />
        <button
          onClick={() => void trigger()}
          disabled={running}
          className="rounded border border-black/15 px-3 py-1 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          Enqueue sample job
        </button>
      </div>
      <pre className="rounded bg-black/90 p-3 text-xs text-green-300 whitespace-pre-wrap">{statusLog.join("\n") || "No jobs yet."}</pre>
    </section>
  );
}
