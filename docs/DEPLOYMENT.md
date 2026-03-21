# DEPLOYMENT (Vercel + Optional External Worker + Redis)

## 1) 기본 Vercel 배포

필수 환경변수:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

권장:
- `RUNNER_MAX_CONCURRENCY=2`
- `NEXT_PUBLIC_RUNNER_SANDBOXED=0` (비샌드박스 경고 표시)

## 2) Redis 연동 (선택)

- `REDIS_URL=redis://...`
- 효과:
  - 분산 환경에서 rate limit 공유
  - queue lease 기반 dequeue(경량)

Redis 미설정 시에도 정상 동작(메모리/DB fallback).

## 3) 외부 워커 분리 (선택)

웹 앱(Vercel):
- `QUEUE_WORKER_MODE=external`
- `WORKER_API_TOKEN=<strong-token>`

워커 프로세스(별도 서버/컨테이너):
- 같은 프로젝트 코드 checkout
- `WORKER_BASE_URL=https://<your-vercel-domain>`
- `WORKER_API_TOKEN=<same-token>`
- `WORKER_LOOP_INTERVAL_MS=1500`
- 실행: `npm run worker:loop`

## 4) 검증 체크

- `/api/health`에서 `workerMode`, `queueMode` 확인
- `/api/metrics`에서 `queueLagMs`, `retryCount`, `failureCount` 확인
- 제출 응답에 queue 정보(`ahead`, `estimatedWaitSec`) 포함되는지 확인
