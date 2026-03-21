# SECURITY.md

## Threat model (요약)

자산:
- 제출 코드 실행 인프라
- 사용자 제출/결과 데이터
- 워커 제어 API

주요 위협:
- 악성 코드 실행을 통한 호스트 탈출 시도
- 워커 API 무단 호출/재전송 공격
- 큐 고장 시 작업 유실/중복 처리

## 이번 마일스톤에서 적용된 완화책

1) Runner hardening
- 실행 모드 추상화: `local` / `isolated` 훅
- 실행 제한: timeout, output cap, CPU/memory 제한(prlimit 가능 시)
- 프로세스 트리 kill
- temp workspace 정리 재시도
- safe-mode 배너

2) Worker API 보호
- shared secret token
- timestamp + HMAC signature
- 허용 오차 검증
- nonce 재사용 차단(Redis NX 또는 in-memory)

3) 운영 안정성
- DLQ(`DEAD_LETTER`) 상태 및 사유 저장
- 관리용 조회/재큐잉 API
- 시작 시 RUNNING 항목 복구
- worker loop idempotency guard(in-flight + redis lock)

4) Observability
- queue + DLQ metrics
- SLO 요약(success rate, p95 처리시간, queue delay p50/p95)
- 오류 taxonomy 코드 도입

## Known limits (아직 완전하지 않은 점)

- `local` 모드는 여전히 동일 호스트 커널을 공유하므로 완전한 샌드박스가 아님
- `prlimit` 미설치 환경에서는 메모리/CPU 제한이 약화될 수 있음
- nonce cache는 Redis 없을 때 프로세스 단위라 멀티 인스턴스 완전 방지는 제한적
- admin maintenance API는 앱 인증/권한 체계에 의존함

## Hardening checklist

- [ ] `RUNNER_EXECUTION_MODE=isolated` 적용
- [ ] 격리 런타임에서 네트워크/파일시스템/권한 최소화
- [ ] `WORKER_API_TOKEN` 충분히 긴 랜덤값 사용 및 주기적 회전
- [ ] Redis 사용 시 TLS/인증 적용
- [ ] `/api/admin/*` 접근제어(관리자 계정) 점검
- [ ] 로그/메트릭 알림(E_* 코드 기반) 연결
- [ ] 정기 취약점 점검 및 dependency 업데이트
