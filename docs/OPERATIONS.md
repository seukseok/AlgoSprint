# OPERATIONS RUNBOOK (Milestone 7)

## 1) 서비스 재시작 시 큐 복구

- 큐는 `JudgeQueueItem` 테이블에 영속 저장됩니다.
- 프로세스 재시작 후 워커가 올라오면 `RUNNING` 상태 항목을 `RETRYING`으로 되돌려 재처리합니다.
- 사용자는 제출 상태에서 `QUEUED -> RUNNING -> 최종 상태(ACCEPTED/WA/RE/TLE/FAILED)`를 확인할 수 있습니다.

## 2) 실패/재시도 정책

- 최대 재시도: 3회 (`maxRetries`)
- 백오프: 1.5s, 3s, 6s (상한 20s)
- 재시도 초과 시:
  - `JudgeQueueItem.status = FAILED`
  - `Submission.status = FAILED`
  - 사용자 메시지: "채점 시스템 오류로 제출 처리에 실패했습니다. 잠시 후 다시 제출해 주세요."

## 3) 운영 중 확인 포인트

- 헬스체크: `GET /api/health`
  - DB 연결
  - 큐 접근 가능 여부
  - 런너 제한값
- 메트릭: `GET /api/metrics`
  - 제출 상태별 건수
  - 큐 상태별 건수
  - 현재 큐 깊이(queueDepth)

## 4) 자주 발생 가능한 장애

1. **컴파일러(g++) 누락**
   - 증상: 실행/제출 모두 실패
   - 조치: 실행 서버에 `g++` 설치 확인

2. **DB 파일 권한 문제(SQLite)**
   - 증상: `/api/health` DB check 실패
   - 조치: `DATABASE_URL` 경로, 파일 쓰기 권한 확인

3. **과도한 요청(429)**
   - 증상: execute/submit가 제한됨
   - 조치: 응답의 `Retry-After` 이후 재시도

## 5) 로그 가이드

- 구조화 로그(JSON) 이벤트 예시
  - `queue.enqueued`
  - `queue.started`
  - `queue.retrying`
  - `queue.failed`
  - `queue.completed`
  - `judge.execute`
  - `runner.process.finished`
