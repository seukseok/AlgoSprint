# DEPLOYMENT (Milestone 9 hardened)

## 필수 보안 환경변수

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `WORKER_API_TOKEN` (강한 랜덤값)

권장:
- `QUEUE_WORKER_MODE=external`
- `WORKER_AUTH_TOLERANCE_MS=300000`
- `RUNNER_EXECUTION_MODE=isolated`
- `RUNNER_ISOLATED_COMMAND=<your isolated runner entrypoint>`
- `RUNNER_CPU_TIME_SECONDS=2`
- `RUNNER_MEMORY_LIMIT_KB=262144`
- `NEXT_PUBLIC_RUNNER_SAFE_MODE=1`

## 외부 워커 구성

웹 앱:
- `QUEUE_WORKER_MODE=external`
- `WORKER_API_TOKEN=<same-token>`

워커(별도 서버/컨테이너):
- `WORKER_BASE_URL=https://<your-domain>`
- `WORKER_API_TOKEN=<same-token>`
- `WORKER_LOOP_INTERVAL_MS=1500`
- 실행: `npm run worker:loop`

## 운영 점검

- `/api/health`: `runnerExecutionMode`, `safeMode`, queue 상태 확인
- `/api/metrics`: `deadLetterCount`, `slo` 확인
- `/api/admin/queue-maintenance`: DLQ 조회/재처리

## 단계별 권장

1. 최소: local 모드 + safe mode banner + worker 서명 인증 적용
2. 중간: Redis 연결 + external worker 분리
3. 권장: isolated runner 훅(컨테이너/VM) 적용 후 public 오픈
