# AlgoSprint C++

Practical algorithm-learning web app built with Next.js + TypeScript.

## Milestone 2 scope

Implemented:

- Persistent backend foundation inside Next app (App Router API routes)
- Prisma + SQLite dev persistence for users/problems/runs/submissions/drafts
- Server-side execute/submit flow (mock judge behavior, persisted run/submission history)
- Async verdict simulation + polling endpoint
- Dashboard stats backed by database (attempts, solved, streak placeholder)
- Workspace UX upgrades:
  - per-problem code draft persistence (localStorage + server sync)
  - keyboard shortcut help modal
  - action output panel with tabs (compile/run/debug/submit)

## API routes

- `GET /api/problems` — list problems
- `GET /api/problems/:id` — problem detail
- `POST /api/execute` — compile/run/debug request (server-side mocked execution + persisted run log)
- `POST /api/submissions` — create queued submission
- `GET /api/submissions/:id` — poll simulated verdict state
- `GET /api/drafts/:problemId` — get saved draft for mock user
- `PUT /api/drafts/:problemId` — save draft for mock user

## Persistence model (Prisma)

- `User`
- `Problem`
- `Submission`
- `Run`
- `CodeDraft`

Schema: `prisma/schema.prisma`

## Auth strategy (placeholder)

Current milestone intentionally uses a single seeded mock user (`demo@algosprint.local`) via server helper.
This keeps development moving while keeping route contracts user-aware.

Planned migration path to NextAuth:

1. Add NextAuth session provider and DB-backed adapter.
2. Replace `getMockUser()` with `getServerSession()` + user upsert.
3. Keep existing data model (`userId` relations already in place).
4. Gradually switch APIs to require authenticated session.

## Real vs placeholder

### Real now

- API-backed execution flow from UI
- Persisted problem/submission/run/draft data on SQLite
- Polling-based async verdict lifecycle (QUEUED -> RUNNING -> final verdict)
- Dashboard stats from submissions data

### Placeholder for future milestones

- Real sandboxed C++ compilation/execution infra
- Real debugger protocol bridge
- Real testcase-by-testcase judge feedback
- Production authentication and permissions
- Queue/worker isolation for judge jobs

## Run locally

```bash
cd /home/seukseok/.openclaw/workspace/projects/algosprint-app
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open <http://localhost:3000>

## Quality checks

```bash
npm run lint
npm run build
```
