# OPERATIONS RUNBOOK (Milestone 8)

## 1) 큐/워커 모드

- 기본값: `QUEUE_WORKER_MODE=embedded`
  - 웹 프로세스가 제출 큐 워커를 함께 처리합니다.
- 분리 모드: `QUEUE_WORKER_MODE=external`
  - 웹 프로세스는 enqueue만 수행
  - 별도 루프(`npm run worker:loop`)가 `POST /api/worker`로 큐를 처리

`/api/worker` 보안:
- `WORKER_API_TOKEN`이 설정되면 `x-worker-token`(또는 Bearer) 필수

## 2) Redis 사용/미사용 동작

- `REDIS_URL` 설정 시:
  - Rate limiting backend: Redis (`X-RateLimit-Backend=redis`)
  - Queue lease/fair dequeue: Redis sorted set + lease key
- `REDIS_URL` 미설정 시:
  - Rate limiting backend: 프로세스 메모리
  - Queue: DB 상태 기반 fallback 동작

즉, Redis 없이도 기능은 유지되며 단일 인스턴스 운용에 적합합니다.

## 3) 실패/재시도 정책

- 최대 재시도: 3회 (`maxRetries`)
- 백오프: 1.5s, 3s, 6s (상한 20s)
- 재시도 초과 시 `Submission.status=FAILED`

## 4) 관측 포인트

- 헬스체크: `GET /api/health`
  - DB, queue, mode(embedded/external), redis/fallback 표시
- 메트릭: `GET /api/metrics`
  - queueDepth
  - queueLagMs
  - retryCount
  - failureCount
  - queueEtaSec
  - queueMode, workerMode

## 5) 실행 보안/동시성

- 비샌드박스 모드에서는 UI 경고 배너 표시 (`NEXT_PUBLIC_RUNNER_SANDBOXED=0`)
- 서버 동시성 가드: `RUNNER_MAX_CONCURRENCY` (기본 2)
- 여전히 인터넷 공개 전에는 컨테이너/VM 격리 권장

## 6) 로그 가이드

구조화 로그(JSON) 주요 이벤트:
- `judge.submit` (requestId 포함)
- `judge.execute` (requestId 포함)
- `queue.enqueued`, `queue.started`, `queue.retrying`, `queue.failed`, `queue.completed`
- `runner.process.finished`
