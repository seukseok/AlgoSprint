# LOCAL_SECURE_RUN

개발 환경에서 상대적으로 안전하게 실행하는 최소 절차:

1) 환경변수
```env
RUNNER_EXECUTION_MODE=isolated
RUNNER_ISOLATED_COMMAND="bash ./scripts/isolated-runner.sh"
RUNNER_ISOLATED_IMAGE=gcc:14
RUNNER_ISOLATED_NETWORK_MODE=none
NEXT_PUBLIC_RUNNER_EXECUTION_MODE=isolated
NEXT_PUBLIC_RUNNER_SANDBOXED=1
NEXT_PUBLIC_RUNNER_SAFE_MODE=1
```

2) 의존성/DB
```bash
npm install
npx prisma db push
```

3) 점검
```bash
npm run smoke
```

4) 런타임 확인
- 앱 실행 후 `/api/health`에서 `checks.runnerIsolationReady=true` 확인
- 에디터에 비격리 경고 배너가 보이면 env 동기화 실패
