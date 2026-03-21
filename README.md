# AlgoSprint C++

Practical algorithm-learning web app built with Next.js + TypeScript.

## Milestone 8 scope (distributed-ready infra with minimal complexity)

Implemented end-to-end:
- Optional Redis integration layer (`REDIS_URL`) for distributed-friendly queue lease + rate limiting backend
- Queue fallback remains DB-backed when Redis is absent
- Worker mode split: embedded(default) / external (`QUEUE_WORKER_MODE=external`) + secured `POST /api/worker`
- External worker loop script: `npm run worker:loop`
- Rate limit backend metadata headers (`X-RateLimit-Backend`) + Korean 429 errors with `Retry-After`
- `/api/metrics` 확장: queue lag, retry count, failure count, ETA, queue/worker mode
- `/api/execute`, `/api/submissions`에 correlation request ID (`X-Request-Id`) 로그 추적 추가
- Runner 서버 동시성 가드 (`RUNNER_MAX_CONCURRENCY`)
- 제출 UX: 접수 시 대기열 위치/예상 대기시간 노출
- Non-sandbox 경고 배너 + 강화된 실행 정책 문서화
- 기존 Milestone 7 기능 전체 유지

Also retained Milestone 6 capabilities:

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
- 학습 피드백 엔진 (제출 직후)
  - 실패 타입 자동 분류: `WA / RE / TLE / CE`
  - 루트 원인 카테고리 추론 + 다음 액션 추천 (`개념 카드`, `유사 문제`, `복습 큐`)
  - 제출 기록/폴링 응답에 피드백 포함
- 약점 추적 스키마 확장
  - 사용자-문제 단위 약점 점수/실패 횟수 추적
  - 사용자-토픽 단위 약점 점수/실패 횟수 추적
- 복습 큐 UX (한국어)
  - 페이지: `/review`
  - 약한 토픽 + 우선 재도전 문제 목록 제공
  - API: `GET /api/review-queue`
- 배포 상태 점검 엔드포인트
  - `GET /api/health` (DB 연결 / 필수 환경 / 러너 제한값 readiness)
- 안전 가드레일 명시
  - 런타임 제한 상수를 README에 공개
  - 앱 전역 에러 바운더리 추가 (`src/app/error.tsx`)

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
- `GET /api/review-queue` — prioritized retry list from weak topics + failed submissions (auth required)
- `GET /api/health` — deploy-time sanity/readiness check (DB + queue + env + runner)
- `GET /api/metrics` — submission/queue 상태 + queue lag/retry/failure/ETA/worker mode
- `POST /api/worker` — external worker tick endpoint (optional token auth)

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

Optional distributed/worker settings:

```env
REDIS_URL="redis://localhost:6379"
QUEUE_WORKER_MODE="embedded" # embedded | external
WORKER_API_TOKEN="change-me" # required only when exposing /api/worker
WORKER_BASE_URL="http://localhost:3000" # for worker loop script
WORKER_LOOP_INTERVAL_MS="1500"
RUNNER_MAX_CONCURRENCY="2"
QUEUE_AVG_JOB_SECONDS="6"
NEXT_PUBLIC_RUNNER_SANDBOXED="0" # 1이면 샌드박스 경고 배너 숨김
```

## Run locally

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open <http://localhost:3000>

Optional external worker (when `QUEUE_WORKER_MODE=external`):

```bash
npm run worker:loop
```

## Quality checks

```bash
npm run lint
npm run build
```

## Runtime guardrails (explicit constants)

Defined in `src/lib/runner-safety-policy.ts` (re-exported via `src/lib/runner-config.ts`):

- Max source size: `RUNNER_LIMITS.maxSourceBytes = 128 * 1024` bytes
- Compile timeout: `RUNNER_LIMITS.compileTimeoutMs = 8000` ms
- Run timeout (per testcase): `RUNNER_LIMITS.runTimeoutMs = 2000` ms
- Combined stdout/stderr cap: `RUNNER_LIMITS.outputLimitBytes = 64 * 1024` bytes
- Stderr log cap: `RUNNER_LIMITS.stderrLogLimitBytes = 8 * 1024` bytes

## Still not production safe

This project is still a lightweight dev-focused runner. Do not expose to untrusted internet traffic yet.

Known gaps:

- No container/VM sandbox isolation (no seccomp/cgroups/jail)
- Redis queue lease는 경량 구현이며 exactly-once 보장을 제공하지 않음 (at-least-once 성격)
- 컨테이너/VM 수준의 강제 sandbox 격리가 기본 제공되지 않음
- Denylist 기반 필터는 우회 가능성 존재
- 강한 멀티테넌트 격리/쿼터 체계는 추가 설계 필요
