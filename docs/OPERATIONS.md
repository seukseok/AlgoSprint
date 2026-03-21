# OPERATIONS RUNBOOK (Milestone 10)

## 1) 러너 실행 모드

- `RUNNER_EXECUTION_MODE=local|isolated`
- `RUNNER_ISOLATED_COMMAND="bash ./scripts/isolated-runner.sh"`
- `RUNNER_ISOLATED_IMAGE=gcc:14`
- `RUNNER_ISOLATED_NETWORK_MODE=none`
- `RUNNER_CPU_TIME_SECONDS`, `RUNNER_MEMORY_LIMIT_KB`

UI 노출 동기화:
- `NEXT_PUBLIC_RUNNER_EXECUTION_MODE`
- `NEXT_PUBLIC_RUNNER_SANDBOXED`
- `NEXT_PUBLIC_RUNNER_SAFE_MODE`

비격리(local) 모드에서는 에디터에 경고 배너가 표시됩니다.

## 2) Health / Preflight

`GET /api/health` 확인 항목:
- `runnerExecutionMode`
- `runnerReadiness` (mode, checks, warnings)
- `checks.runnerIsolationReady`

`runnerIsolationReady=false` 이면 public 오픈 금지.

## 3) 워커 인증/재전송 방지

`POST /api/worker` 보호 방식:
- `x-worker-token` 또는 `Authorization: Bearer`
- `x-worker-ts` (epoch ms)
- `x-worker-signature` = HMAC-SHA256(token, `${timestamp}.${body}`)
- 허용 시간 오차: `WORKER_AUTH_TOLERANCE_MS`
- nonce 재사용 방지: Redis NX 또는 메모리 캐시

## 4) Smoke checks

```bash
npm run smoke
```

포함 항목:
- lint
- build
- runner self-test (`scripts/runner-selftest.mjs`)

isolated 모드에서 Docker가 없으면 self-test stderr에 fallback 경고가 출력됩니다.
