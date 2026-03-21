# OPERATIONS RUNBOOK (Milestone 9)

## 1) 안전 모드 / 러너 실행 모드

- `NEXT_PUBLIC_RUNNER_SAFE_MODE=1`
  - 상단 배너에 안전 모드 표시
- `RUNNER_EXECUTION_MODE=local|isolated`
  - `local`(기본): 현재 서버 프로세스에서 실행 (기존 호환)
  - `isolated`: `RUNNER_ISOLATED_COMMAND` 훅으로 위임 실행
- `RUNNER_ISOLATED_COMMAND` 예시
  - 컨테이너 래퍼/격리 런타임 호출 스크립트

추가 보호:
- CPU 제한: `RUNNER_CPU_TIME_SECONDS`
- 메모리 제한 힌트: `RUNNER_MEMORY_LIMIT_KB` (prlimit 가능 시 적용)
- 타임아웃 + 프로세스 트리 강제 종료 + 임시 디렉토리 재시도 정리

## 2) 워커 인증/재전송 방지

`POST /api/worker` 보호 방식:
- `x-worker-token` 또는 `Authorization: Bearer`
- `x-worker-ts` (epoch ms)
- `x-worker-signature` = HMAC-SHA256(token, `${timestamp}.${body}`)
- 허용 시간 오차: `WORKER_AUTH_TOLERANCE_MS` (기본 5분)
- nonce(서명) 재사용 방지: Redis NX 또는 메모리 캐시

`worker:loop` 스크립트는 위 헤더를 자동 생성합니다.

## 3) 실패/재시도/DLQ

- 재시도 최대: 3회
- 백오프: 1.5s, 3s, 6s (최대 20s)
- 재시도 소진 시 `JudgeQueueItem.status=DEAD_LETTER`
  - `deadLetterReason`, `deadLetteredAt` 기록

운영자 관리 API(로그인 + admin 권한):
- `GET /api/admin/queue-maintenance?limit=50` : DLQ 조회
- `POST /api/admin/queue-maintenance` with `{ submissionId }` : DLQ 재큐잉

## 4) 복구/멱등성

- 서버 시작 시 RUNNING 항목을 RETRYING으로 복구
- 워커 실행 중복 방지:
  - 프로세스 내 단일 in-flight guard
  - Redis 분산 락(`judge:worker:lock`) best-effort

## 5) 메트릭 / SLO

`GET /api/metrics`:
- queueDepth, queueLagMs, retryCount, failureCount, deadLetterCount
- `slo` 섹션
  - successRate
  - processingP95Ms
  - queueDelayP50Ms / queueDelayP95Ms

## 6) 오류 코드 (taxonomy)

주요 코드:
- `E_WORKER_UNAUTHORIZED`
- `E_WORKER_TIMESTAMP_INVALID`
- `E_WORKER_REPLAY_REJECTED`
- `E_QUEUE_PROCESSING_FAILED`
- `E_RUNNER_EXEC_TIMEOUT`
- `E_RUNNER_OUTPUT_LIMIT`

로그/응답에서 코드로 분류해 알림 규칙을 만들 수 있습니다.
