# AlgoSprint C++

Practical algorithm-learning web app built with Next.js + TypeScript.

## Milestone 4 scope (auth + queue + hardening)

Implemented end-to-end:

- NextAuth authentication
  - GitHub provider (`GITHUB_ID`, `GITHUB_SECRET`)
  - Dev credentials fallback in non-production (`DEV_LOGIN_EMAIL`, `DEV_LOGIN_PASSWORD`)
  - Custom sign-in page at `/auth/signin`
- Protected coding/history surfaces for signed-in users
  - Pages: `/problems/[id]`, `/submissions`
  - APIs: `/api/execute`, `/api/submissions`, `/api/submissions/:id`, `/api/drafts/:problemId`
- Real session-to-DB user mapping
  - Session email is upserted into `User` table
  - Run logs, drafts, and submissions now use real signed-in user IDs
- Judge queue foundation (in-process worker)
  - Submission lifecycle: `QUEUED -> RUNNING -> final verdict`
  - Queue-backed submit API and live polling via `/api/submissions/:id`
  - Poll counter incremented on status polling
- Runner hardening pass
  - Centralized runner limits/constants (`src/lib/runner-config.ts`)
  - Stricter denylist checks and max source size guard
  - Filename/path sanitization for temp workspace/files
  - Safer stderr truncation for logs
- Admin/dev queue harness
  - Protected page: `/admin/harness`
  - Trigger sample queued jobs and watch transition logs
  - API: `POST /api/admin/queue-test`

## API routes

- `GET /api/problems` — list problems
- `GET /api/problems/:id` — get one problem
- `POST /api/execute` — compile/run/debug and persist run log (auth required)
- `POST /api/submissions` — enqueue submission (auth required)
- `GET /api/submissions/:id` — poll live status/result (auth required, owner-only)
- `GET /api/submissions` — list recent submissions (auth required)
- `GET /api/drafts/:problemId` — get saved draft (auth required)
- `PUT /api/drafts/:problemId` — save draft (auth required)
- `POST /api/admin/queue-test` — enqueue admin test submission (admin/dev only)

## Environment setup

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Required baseline:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="replace-with-random-secret"
NEXTAUTH_URL="http://localhost:3000"
```

GitHub OAuth (recommended):

```env
GITHUB_ID="..."
GITHUB_SECRET="..."
```

Dev credentials fallback (non-production only):

```env
DEV_LOGIN_EMAIL="dev@algosprint.local"
DEV_LOGIN_PASSWORD="devpass123"
```

Admin emails (for `/admin/harness` in production):

```env
ADMIN_EMAILS="you@example.com,teammate@example.com"
```

## Run locally

```bash
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

## Still not production safe

This project is still a lightweight dev-focused runner. Do not expose to untrusted internet traffic yet.

Known gaps:

- No container/VM sandbox isolation (no seccomp/cgroups/jail)
- In-process queue is not durable/distributed
- Denylist remains heuristic and bypassable
- No robust per-tenant quota/rate limiting yet
