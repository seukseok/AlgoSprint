# PREDEPLOY CHECKLIST

## 필수 설정

- [ ] `.env`에 `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` 설정
- [ ] OAuth/개발 로그인 설정 점검 (`GITHUB_ID`, `GITHUB_SECRET` 또는 dev credentials)
- [ ] 운영자 이메일(`ADMIN_EMAILS`) 필요 시 설정

## 분산/워커 옵션

- [ ] Redis 사용 시 `REDIS_URL` 연결 확인
- [ ] 외부 워커 모드 사용 시 `QUEUE_WORKER_MODE=external` 설정
- [ ] `/api/worker` 보호를 위해 `WORKER_API_TOKEN` 설정
- [ ] 외부 워커 루프(`npm run worker:loop`) 별도 프로세스/인스턴스에서 기동

## 데이터/스키마

- [ ] `npx prisma db push` 실행
- [ ] `JudgeQueueItem` 테이블 생성 확인
- [ ] `SubmissionStatus.FAILED` enum 반영 확인

## 빌드/품질

- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과

## 운영 점검

- [ ] `GET /api/health`가 정상(200) 응답
- [ ] `GET /api/metrics` 응답 확인 (`queueLagMs`, `retryCount`, `failureCount`, `queueEtaSec` 포함)
- [ ] 제출 후 큐 상태 전이(QUEUED→RUNNING→최종) 확인
- [ ] 재시도/실패 시나리오(최대 재시도 후 FAILED) 검증

## 보안/제한

- [ ] execute/submit rate limit 동작 확인(429 + Retry-After)
- [ ] Redis 활성화 시 `X-RateLimit-Backend=redis` 확인
- [ ] 요청 payload 검증(빈 source/과대 source/잘못된 action)
- [ ] `RUNNER_MAX_CONCURRENCY` 적정값 설정
- [ ] 비샌드박스 경고 배너 노출 정책 확인(`NEXT_PUBLIC_RUNNER_SANDBOXED`)
- [ ] 러너 정책 문서(`src/lib/runner-safety-policy.ts`) 확인
