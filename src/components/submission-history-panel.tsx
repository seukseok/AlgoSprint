"use client";

import { useEffect, useState } from "react";

type HistoryItem = {
  id: string;
  problemId: string;
  status: string;
  output: string | null;
  elapsedMs: number | null;
  exitCode: number | null;
  createdAt: string;
  testcaseSummary: { index: number; passed: boolean }[];
};

export function SubmissionHistoryPanel({ problemId }: { problemId?: string }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const url = problemId ? `/api/submissions?problemId=${problemId}` : "/api/submissions";
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { items: HistoryItem[] };
        setItems(data.items);
      }
      setLoading(false);
    })();
  }, [problemId]);

  return (
    <section className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111827]">
      <h3 className="text-sm font-semibold">제출 기록 {problemId ? "(현재 문제)" : ""}</h3>
      {loading ? <p className="mt-2 text-sm text-black/60 dark:text-white/60">불러오는 중...</p> : null}
      {!loading && items.length === 0 ? <p className="mt-2 text-sm text-black/60 dark:text-white/60">아직 제출 내역이 없습니다.</p> : null}
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <article key={item.id} className="rounded border border-black/10 p-3 text-xs dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{item.problemId}</div>
              <div>{item.status}</div>
            </div>
            <div className="mt-1 text-black/60 dark:text-white/60">
              {new Date(item.createdAt).toLocaleString()} · {item.elapsedMs ?? "-"}ms · 종료코드 {item.exitCode ?? "-"}
            </div>
            {item.testcaseSummary?.length ? (
              <div className="mt-1">
                {item.testcaseSummary.map((tc) => (
                  <span key={tc.index} className="mr-2">
                    #{tc.index}:{tc.passed ? "통과" : "실패"}
                  </span>
                ))}
              </div>
            ) : null}
            {item.output ? <pre className="mt-2 whitespace-pre-wrap text-[11px]">{item.output}</pre> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
