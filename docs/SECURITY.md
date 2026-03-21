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

## Milestone 10 보안 강화

### 1) Isolated runner wrapper (Docker 우선)

기본 권장 설정:

```bash
RUNNER_EXECUTION_MODE=isolated
RUNNER_ISOLATED_COMMAND="bash ./scripts/isolated-runner.sh"
RUNNER_ISOLATED_IMAGE="gcc:14"
RUNNER_ISOLATED_NETWORK_MODE="none"
RUNNER_CPU_TIME_SECONDS=2
RUNNER_MEMORY_LIMIT_KB=262144
NEXT_PUBLIC_RUNNER_EXECUTION_MODE=isolated
NEXT_PUBLIC_RUNNER_SANDBOXED=1
NEXT_PUBLIC_RUNNER_SAFE_MODE=1
```

`isolated-runner.sh`가 적용하는 제한:
- `--network none`
- `--cpus 1.0`
- `--memory` / `--memory-swap` 제한
- `--pids-limit`
- `--cap-drop ALL`, `no-new-privileges`
- `--read-only` root fs + `tmpfs /tmp`
- 비 root 사용자(65534) 실행
- 작업 디렉토리만 read-write 마운트

Docker 미사용/불가 환경:
- 명시적 경고를 stderr에 남기고 host 실행으로 fallback
- 관련 코드: `E_RUNNER_ISOLATION_UNAVAILABLE`

### 2) Runner 실행 안정성/분류

- local vs isolated 모드 환경변수 분리
- 오류 taxonomy 확장:
  - `E_RUNNER_ISOLATION_UNAVAILABLE`
  - `E_RUNNER_ISOLATION_FAILED`
- `/api/health`에 `runnerReadiness` + `runnerIsolationReady` 노출

### 3) Worker API 보호

`POST /api/worker` 보호 방식:
- shared secret token
- timestamp + HMAC signature
- 허용 오차 검증
- nonce 재사용 차단(Redis NX 또는 in-memory)

### 4) 운영 안정성

- DLQ(`DEAD_LETTER`) 상태 및 사유 저장
- 관리용 조회/재큐잉 API
- 시작 시 RUNNING 항목 복구
- worker loop idempotency guard(in-flight + redis lock)

## Hardening checklist

- [ ] Docker daemon rootless 또는 전용 low-privilege host에서 운영
- [ ] `RUNNER_EXECUTION_MODE=isolated` + `RUNNER_ISOLATED_COMMAND` 적용
- [ ] `RUNNER_ISOLATED_NETWORK_MODE=none` 유지
- [ ] `WORKER_API_TOKEN` 충분히 긴 랜덤값 사용 및 주기적 회전
- [ ] Redis 사용 시 TLS/인증 적용
- [ ] `/api/admin/*` 접근제어(관리자 계정) 점검
- [ ] 로그/메트릭 알림(E_* 코드 기반) 연결
- [ ] 정기 dependency 업데이트 + 취약점 점검

## Known limits

- Docker fallback은 개발 편의 목적이며 production에서는 비권장
- 코드 denylist는 보조 수단이며 완전한 보안 경계가 아님
- 강한 멀티테넌트 격리(전용 노드풀/VM-per-job/서명된 이미지)는 추가 작업 필요
