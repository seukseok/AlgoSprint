# AlgoSprint C++

Practical algorithm-learning web app built with Next.js + TypeScript.

## Milestone 3 scope (execution foundations)

Implemented end-to-end:

- Real C++17 compile/run path on server via `g++`
- Input-aware execution (`stdin`) with timeout caps
- Captured stdout/stderr, exit code, elapsed time
- Persisted run logs in SQLite (`Run`)
- Submission judge on sample testcases per problem
- Verdicts: `ACCEPTED`, `WRONG_ANSWER`, `COMPILATION_ERROR`, `RUNTIME_ERROR`, `TIME_LIMIT_EXCEEDED`
- Stored testcase breakdown JSON per submission
- Problem-specific submission history panel
- Global submission history page (`/submissions`)

## Security safeguards (lightweight)

Current safeguards are intentionally lightweight (non-containerized):

- compile timeout + run timeout (hard kill)
- output size cap (stdout+stderr)
- simple source denylist check (`system`, `popen`, `fork`, socket-related includes, `exec*`)

Important limitations:

- No OS/container sandbox yet
- No syscall-level isolation/cgroups/seccomp
- Denylist is heuristic and bypassable
- Suitable for local/dev experiments, not untrusted internet-scale multi-tenant production

## API routes

- `GET /api/problems` — list problems
- `POST /api/execute` — compile/run/debug execution and persist run log
- `POST /api/submissions` — judge against sample tests and persist verdict + summary
- `GET /api/submissions/:id` — fetch submission verdict/detail
- `GET /api/submissions` — list recent submissions (optional `?problemId=...`)
- `GET /api/drafts/:problemId` — get saved draft for mock user
- `PUT /api/drafts/:problemId` — save draft for mock user

## Persistence model (Prisma)

- `User`
- `Problem`
- `Submission` (status + testcase summary + elapsed/exit metadata)
- `Run` (stdout/stderr/exit/time metadata)
- `CodeDraft`

Schema: `prisma/schema.prisma`

## Auth strategy (still placeholder)

Uses a single seeded mock user (`demo@algosprint.local`) for development speed.

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
