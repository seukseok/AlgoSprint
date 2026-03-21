"use client";

import Editor, { OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeJudgeAction } from "@/lib/judge";
import { JudgeAction } from "@/lib/types";

const actions: { key: JudgeAction; label: string; shortcut: string }[] = [
  { key: "compile", label: "컴파일", shortcut: "Ctrl/Cmd + Shift + B" },
  { key: "run", label: "실행", shortcut: "Ctrl/Cmd + Enter" },
  { key: "debug", label: "디버그", shortcut: "F5" },
  { key: "submit", label: "제출", shortcut: "Ctrl/Cmd + S" },
];

type EditorTheme = "github-dark" | "vs-dark" | "vs";
type OutputMap = Record<JudgeAction, string>;

const initialOutputs: OutputMap = {
  compile: "컴파일 결과가 여기에 표시됩니다.",
  run: "실행 결과가 여기에 표시됩니다.",
  debug: "디버그 결과가 여기에 표시됩니다.",
  submit: "제출 결과가 여기에 표시됩니다.",
};

const IS_NON_SANDBOXED = process.env.NEXT_PUBLIC_RUNNER_SANDBOXED !== "1";

export function EditorWorkspace({
  problemId,
  starterCode,
}: {
  problemId: string;
  starterCode: string;
}) {
  const [code, setCode] = useState(starterCode);
  const [stdin, setStdin] = useState("");
  const [activeTheme, setActiveTheme] = useState<EditorTheme>("vs-dark");
  const [running, setRunning] = useState<JudgeAction | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<JudgeAction>("compile");
  const [outputs, setOutputs] = useState<OutputMap>(initialOutputs);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [draftSyncLabel, setDraftSyncLabel] = useState("아직 동기화되지 않음");

  useEffect(() => {
    const key = `algosprint:draft:${problemId}`;

    void (async () => {
      const localCode = window.localStorage.getItem(key);
      if (localCode) setCode(localCode);

      const response = await fetch(`/api/drafts/${problemId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { code: string | null };
      if (data.code) {
        setCode(data.code);
        window.localStorage.setItem(key, data.code);
        setDraftSyncLabel("서버에서 임시 코드를 복원했습니다");
      }
    })();
  }, [problemId]);

  useEffect(() => {
    const key = `algosprint:draft:${problemId}`;
    window.localStorage.setItem(key, code);

    const timeout = setTimeout(() => {
      void (async () => {
        const response = await fetch(`/api/drafts/${problemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        if (response.ok) setDraftSyncLabel(`동기화 시각: ${new Date().toLocaleTimeString()}`);
      })();
    }, 900);

    return () => clearTimeout(timeout);
  }, [code, problemId]);

  const runAction = useCallback(
    async (action: JudgeAction) => {
      if (running) return;
      setRunning(action);
      setActiveOutputTab(action);
      try {
        const result = await executeJudgeAction({ action, source: code, stdin, problemId });
        const metrics = result.timeMs || result.memoryKb ? `\n\n[metrics] time=${result.timeMs ?? "-"}ms memory=${result.memoryKb ?? "-"}KB` : "";
        const text = `[${result.action.toUpperCase()}] ${result.success ? "성공" : "실패"}\n${result.output}${metrics}`;
        setOutputs((prev) => ({ ...prev, [action]: text }));
      } finally {
        setRunning(null);
      }
    },
    [code, stdin, problemId, running],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key === "Enter") {
        event.preventDefault();
        void runAction("run");
      }
      if (meta && event.shiftKey && (event.key === "B" || event.key === "b")) {
        event.preventDefault();
        void runAction("compile");
      }
      if (event.key === "F5") {
        event.preventDefault();
        void runAction("debug");
      }
      if (meta && (event.key === "S" || event.key === "s")) {
        event.preventDefault();
        void runAction("submit");
      }
      if (event.key === "?" && event.shiftKey) {
        event.preventDefault();
        setShowShortcutHelp((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runAction]);

  const onMount: OnMount = useCallback((editor, monaco) => {
    monaco.editor.defineTheme("github-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8B949E" },
        { token: "keyword", foreground: "FF7B72" },
        { token: "string", foreground: "A5D6FF" },
      ],
      colors: {
        "editor.background": "#0d1117",
        "editor.lineHighlightBackground": "#161b22",
        "editorCursor.foreground": "#c9d1d9",
      },
    });
    editor.focus();
  }, []);

  const buttonDisabled = useMemo(() => Boolean(running), [running]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#111827]">
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              onClick={() => void runAction(action.key)}
              disabled={buttonDisabled}
              className="rounded border border-black/15 px-3 py-1 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              {running === action.key ? `${action.label} 처리 중...` : action.label}
            </button>
          ))}
          <button
            onClick={() => setShowShortcutHelp(true)}
            className="rounded border border-black/15 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            단축키
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          에디터 테마
          <select
            value={activeTheme}
            onChange={(event) => setActiveTheme(event.target.value as EditorTheme)}
            className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
          >
            <option value="github-dark">GitHub 다크</option>
            <option value="vs-dark">VS Code 다크</option>
            <option value="vs">VS Code 라이트</option>
          </select>
        </label>
      </div>

      <div className="text-xs text-black/60 dark:text-white/60">임시 코드 상태: {draftSyncLabel}</div>

      {IS_NON_SANDBOXED ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/70 dark:bg-amber-900/20 dark:text-amber-200">
          경고: 현재 실행 환경은 컨테이너/VM 샌드박스가 아닙니다. 신뢰 가능한 코드만 실행하고, 외부 공개 환경에서는 반드시 격리 런타임을 사용하세요.
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[2fr,1fr]">
        <div className="h-[520px] overflow-hidden rounded-md border border-black/10 dark:border-white/10">
          <Editor
            height="100%"
            defaultLanguage="cpp"
            value={code}
            onChange={(value) => setCode(value ?? "")}
            theme={activeTheme}
            onMount={onMount}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#111827]">
            <h3 className="mb-2 text-sm font-semibold">입력(stdin)</h3>
            <textarea
              value={stdin}
              onChange={(event) => setStdin(event.target.value)}
              placeholder="선택 입력값"
              className="h-28 w-full rounded border border-black/10 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:border-white/15"
            />
          </div>

          <div className="rounded-md border border-black/10 bg-black p-3 text-xs text-green-300 dark:border-white/10">
            <div className="mb-2 flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.key}
                  onClick={() => setActiveOutputTab(action.key)}
                  className={`rounded px-2 py-1 text-xs ${
                    activeOutputTab === action.key ? "bg-white/20 text-white" : "bg-white/5 text-green-200"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <h3 className="mb-2 text-sm font-semibold text-white">실행 결과</h3>
            <pre className="whitespace-pre-wrap">{running === activeOutputTab ? `${actions.find((a) => a.key === running)?.label} 실행 중...` : outputs[activeOutputTab]}</pre>
          </div>
        </div>
      </div>

      {showShortcutHelp ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/50 p-4" onClick={() => setShowShortcutHelp(false)}>
          <div
            className="w-full max-w-md rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111827]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">키보드 단축키</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {actions.map((action) => (
                <li key={action.key} className="flex justify-between">
                  <span>{action.label}</span>
                  <span className="text-black/60 dark:text-white/60">{action.shortcut}</span>
                </li>
              ))}
              <li className="flex justify-between">
                <span>도움말 토글</span>
                <span className="text-black/60 dark:text-white/60">Shift + ?</span>
              </li>
            </ul>
            <button
              onClick={() => setShowShortcutHelp(false)}
              className="mt-4 rounded border border-black/15 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
