"use client";

import { useEffect } from "react";

export default function GlobalErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error-boundary]", error);
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
      <h1 className="text-lg font-semibold">일시적인 오류가 발생했습니다.</h1>
      <p className="mt-2">페이지를 안전하게 복구할 수 있도록 상태를 초기화해 다시 시도해 주세요.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded border border-red-300 px-3 py-1.5 text-xs hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/30"
      >
        다시 시도
      </button>
    </section>
  );
}
