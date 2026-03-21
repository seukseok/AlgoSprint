# DEPLOYMENT (Milestone 10)

## 필수 환경변수

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `WORKER_API_TOKEN`

## 권장 운영값 (production)

```env
QUEUE_WORKER_MODE=external
RUNNER_EXECUTION_MODE=isolated
RUNNER_ISOLATED_COMMAND="bash ./scripts/isolated-runner.sh"
RUNNER_ISOLATED_IMAGE=gcc:14
RUNNER_ISOLATED_NETWORK_MODE=none
RUNNER_CPU_TIME_SECONDS=2
RUNNER_MEMORY_LIMIT_KB=262144
NEXT_PUBLIC_RUNNER_EXECUTION_MODE=isolated
NEXT_PUBLIC_RUNNER_SANDBOXED=1
NEXT_PUBLIC_RUNNER_SAFE_MODE=1
```

## 배포 전 체크

1. `npm run smoke`
2. `/api/health`에서 아래 확인
   - `status=ok`
   - `checks.runnerIsolationReady=true`
   - `runnerReadiness.mode="isolated"`
3. `/api/metrics`에서 queue/DLQ 확인

## 외부 워커 구성

웹 앱:
- `QUEUE_WORKER_MODE=external`
- `WORKER_API_TOKEN=<same-token>`

워커:
- `WORKER_BASE_URL=https://<your-domain>`
- `WORKER_API_TOKEN=<same-token>`
- 실행: `npm run worker:loop`

## 단계별 권장

1. 최소: local 모드 + safe mode + 인증/레이트리밋
2. 중간: Redis + external worker
3. 권장: isolated runner + health preflight ok 후 public 오픈
