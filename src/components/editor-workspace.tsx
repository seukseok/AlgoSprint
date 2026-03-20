"use client";

import Editor, { OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeJudgeAction } from "@/lib/judge";
import { JudgeAction } from "@/lib/types";

const actions: { key: JudgeAction; label: string; shortcut: string }[] = [
  { key: "compile", label: "Compile", shortcut: "Ctrl/Cmd + Shift + B" },
  { key: "run", label: "Run", shortcut: "Ctrl/Cmd + Enter" },
  { key: "debug", label: "Debug", shortcut: "F5" },
  { key: "submit", label: "Submit", shortcut: "Ctrl/Cmd + S" },
];

type EditorTheme = "github-dark" | "vs-dark" | "vs";

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
  const [lastOutput, setLastOutput] = useState("Ready.");
  const [running, setRunning] = useState<JudgeAction | null>(null);

  const runAction = useCallback(
    async (action: JudgeAction) => {
      setRunning(action);
      const result = await executeJudgeAction({
        action,
        source: code,
        stdin,
        problemId,
      });
      const metrics =
        result.timeMs || result.memoryKb
          ? `\n\n[metrics] time=${result.timeMs ?? "-"}ms memory=${result.memoryKb ?? "-"}KB`
          : "";
      setLastOutput(`[${result.action.toUpperCase()}] ${result.success ? "SUCCESS" : "FAILED"}\n${result.output}${metrics}`);
      setRunning(null);
    },
    [code, stdin, problemId],
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
              {action.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          Editor theme
          <select
            value={activeTheme}
            onChange={(event) => setActiveTheme(event.target.value as EditorTheme)}
            className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
          >
            <option value="github-dark">GitHub Dark</option>
            <option value="vs-dark">VS Code Dark</option>
            <option value="vs">VS Code Light</option>
          </select>
        </label>
      </div>

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
            <h3 className="mb-2 text-sm font-semibold">Input (stdin)</h3>
            <textarea
              value={stdin}
              onChange={(event) => setStdin(event.target.value)}
              placeholder="Optional custom input"
              className="h-28 w-full rounded border border-black/10 bg-transparent p-2 text-sm outline-none focus:border-black/30 dark:border-white/15"
            />
          </div>

          <div className="rounded-md border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#111827]">
            <h3 className="mb-2 text-sm font-semibold">Debug Panel</h3>
            <p className="text-sm text-black/70 dark:text-white/70">
              Breakpoints/watch/step controls are prepared in UI flow. Runtime debugger backend is a placeholder in this milestone.
            </p>
          </div>

          <div className="rounded-md border border-black/10 bg-black p-3 text-xs text-green-300 dark:border-white/10">
            <h3 className="mb-2 text-sm font-semibold text-white">Console</h3>
            <pre className="whitespace-pre-wrap">{running ? `Running ${running}...` : lastOutput}</pre>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-black/10 bg-white p-3 text-xs text-black/70 dark:border-white/10 dark:bg-[#111827] dark:text-white/70">
        Shortcuts: {actions.map((action) => `${action.label} (${action.shortcut})`).join(" · ")}
      </div>
    </section>
  );
}
