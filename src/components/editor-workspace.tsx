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

const PUBLIC_EXEC_MODE = process.env.NEXT_PUBLIC_RUNNER_EXECUTION_MODE ?? "local";
const IS_NON_SANDBOXED = process.env.NEXT_PUBLIC_RUNNER_SANDBOXED !== "1" || PUBLIC_EXEC_MODE !== "isolated";

export function EditorWorkspace({ starterCode }: { starterCode: string }) {
  const [code, setCode] = useState(starterCode);
  const [stdin, setStdin] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [activeTheme, setActiveTheme] = useState<EditorTheme>("vs-dark");
  const [running, setRunning] = useState<JudgeAction | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<JudgeAction>("compile");
  const [outputs, setOutputs] = useState<OutputMap>(initialOutputs);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [bojUrl, setBojUrl] = useState("https://www.acmicpc.net");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);

  useEffect(() => {
    const localCode = window.localStorage.getItem("algosprint:compiler:code");
    const localStdin = window.localStorage.getItem("algosprint:compiler:stdin");
    const localBojUrl = window.localStorage.getItem("algosprint:compiler:boj-url");
    if (localCode) setCode(localCode);
    if (localStdin) setStdin(localStdin);
    if (localBojUrl) setBojUrl(localBojUrl);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("algosprint:compiler:code", code);
  }, [code]);

  useEffect(() => {
    window.localStorage.setItem("algosprint:compiler:stdin", stdin);
  }, [stdin]);

  useEffect(() => {
    window.localStorage.setItem("algosprint:compiler:boj-url", bojUrl);
  }, [bojUrl]);

  const runAction = useCallback(
    async (action: JudgeAction) => {
      if (running) return;
      setRunning(action);
      setActiveOutputTab(action);
      try {
        const result = await executeJudgeAction({ action, source: code, stdin });
        const metrics = result.timeMs || result.memoryKb ? `\n\n[metrics] time=${result.timeMs ?? "-"}ms memory=${result.memoryKb ?? "-"}KB` : "";
        const text = `[${result.action.toUpperCase()}] ${result.success ? "성공" : "실패"}\n${result.output}${metrics}`;
        setOutputs((prev) => ({ ...prev, [action]: text }));
      } finally {
        setRunning(null);
      }
    },
    [code, stdin, running],
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

  useEffect(() => {
    setIframeLoaded(false);
    setIframeTimedOut(false);
    const timer = setTimeout(() => {
      setIframeTimedOut(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [bojUrl]);

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
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            className="rounded border border-black/15 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            코드 복사
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

      {IS_NON_SANDBOXED ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/70 dark:bg-amber-900/20 dark:text-amber-200">
          경고: 현재 실행 환경은 비격리 모드(local)입니다. 신뢰 가능한 코드만 실행하고, 외부 공개 환경에서는 반드시 RUNNER_EXECUTION_MODE=isolated + 컨테이너 격리를 사용하세요.
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1fr,1.7fr] lg:auto-rows-min">
        <div className="h-[52vh] min-h-[420px] overflow-hidden rounded-md border border-black/10 dark:border-white/10 lg:col-start-2 lg:h-[68vh]">
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

        <div className="space-y-3 lg:col-start-2">
          <div className="rounded-md border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#111827]">
            <h3 className="mb-2 text-sm font-semibold">입력(stdin)</h3>
            <textarea
              value={stdin}
              onChange={(event) => setStdin(event.target.value)}
              placeholder="BOJ 샘플 입력을 붙여넣으세요"
              className="h-44 w-full rounded border border-black/10 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:border-white/15"
            />
          </div>

          <div className="rounded-md border border-black/10 bg-white p-3 text-xs dark:border-white/10 dark:bg-[#111827]">
            <h3 className="mb-2 text-sm font-semibold">BOJ 붙여넣기 도우미</h3>
            <p className="mb-2 text-black/70 dark:text-white/70">BOJ 문제 페이지의 예제 입력을 복사해 아래 칸에 붙여넣고, 적용 버튼으로 stdin에 반영하세요.</p>
            <textarea
              value={sampleInput}
              onChange={(event) => setSampleInput(event.target.value)}
              placeholder="예제 입력 임시 붙여넣기 영역"
              className="h-24 w-full rounded border border-black/10 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:border-white/15"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setStdin(sampleInput)}
                className="rounded border border-black/15 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                stdin에 적용
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(stdin)}
                className="rounded border border-black/15 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                stdin 복사
              </button>
            </div>
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

        <div className="space-y-3 rounded-md border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#111827] lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:max-h-[calc(68vh+theme(spacing.12))] lg:overflow-auto">
          <h3 className="text-sm font-semibold">BOJ 컴패니언</h3>
          <label className="text-xs text-black/70 dark:text-white/70">문제 URL</label>
          <input
            value={bojUrl}
            onChange={(event) => setBojUrl(event.target.value)}
            placeholder="https://www.acmicpc.net/problem/1000"
            className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/30 dark:border-white/20"
          />
          <div className="flex gap-2">
            <button
              onClick={() => window.open(bojUrl, "_blank", "noopener,noreferrer")}
              className="rounded border border-black/15 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              새 탭에서 열기
            </button>
            <button
              onClick={() => setBojUrl("https://www.acmicpc.net/problem/1000")}
              className="rounded border border-black/15 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              예시 URL
            </button>
          </div>
          <div className="h-[460px] overflow-hidden rounded border border-black/10 bg-black/5 dark:border-white/10 dark:bg-black/20">
            <iframe
              key={bojUrl}
              src={bojUrl}
              title="BOJ companion"
              className="h-full w-full"
              onLoad={() => {
                setIframeLoaded(true);
                setIframeTimedOut(false);
              }}
            />
          </div>
          {iframeTimedOut && !iframeLoaded ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700/70 dark:bg-amber-900/20 dark:text-amber-200">
              BOJ 페이지가 iframe 정책(X-Frame-Options/CSP)으로 차단될 수 있습니다. 이 경우 위의 새 탭에서 열기 버튼으로 문제를 여세요.
            </div>
          ) : null}
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
