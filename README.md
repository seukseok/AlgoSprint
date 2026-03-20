# AlgoSprint C++

Minimal, practical algorithm-learning web app scaffolded with Next.js + TypeScript.

## Milestone 1 scope

Implemented in this milestone:

- Next.js app scaffold (`app/` router, TypeScript)
- Minimal clean UI (dashboard, problem list, problem detail/workspace)
- Monaco-based C++ coding workspace
- Action flow buttons + keyboard shortcuts:
  - Compile (`Ctrl/Cmd + Shift + B`)
  - Run (`Ctrl/Cmd + Enter`)
  - Debug (`F5`)
  - Submit (`Ctrl/Cmd + S`)
- Editor theme options:
  - GitHub Dark (custom Monaco theme)
  - VS Code Dark (`vs-dark`)
  - VS Code Light (`vs`)
- Judge integration-ready service layer (`src/lib/judge.ts`)

## Real vs placeholder

### Real (working now)

- Page routing and shell UX
- Monaco editor integration for C++
- Keyboard shortcuts + action dispatch
- Compile/Run/Debug/Submit action pipeline via `executeJudgeAction()`
- Console output panel and basic input panel

### Placeholder (for next milestones)

- Real compiler/runtime sandbox (currently mocked)
- Real debugger backend and step/breakpoint synchronization (UI flow exists)
- Real submission + verdict polling against online judge
- Authentication, persistence, and user submission history

## Run locally

```bash
cd /home/seukseok/.openclaw/workspace/projects/algosprint-app
npm install
npm run dev
```

Open <http://localhost:3000>

## Build check

```bash
npm run build
```

## Project structure (key files)

- `src/app/page.tsx` — dashboard
- `src/app/problems/page.tsx` — problem list
- `src/app/problems/[id]/page.tsx` — problem detail + workspace
- `src/components/editor-workspace.tsx` — Monaco editor and action/shortcut handling
- `src/lib/problems.ts` — sample problem dataset
- `src/lib/judge.ts` — judge gateway interface + mock implementation

## Architecture notes for online judge integration

- Keep UI calling `executeJudgeAction(...)` only.
- Swap `judgeGateway` implementation from mock to API-backed gateway.
- Add async job IDs + polling/websocket stream for compile/run/submit outputs.
- Extend `JudgeResult` with testcase breakdown, compile errors, and verdict metadata.
