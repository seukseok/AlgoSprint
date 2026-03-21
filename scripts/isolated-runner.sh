#!/usr/bin/env bash
set -euo pipefail

PAYLOAD="${1:-}"
if [[ -z "$PAYLOAD" ]]; then
  echo "[E_RUNNER_RUNTIME_FAILED] missing payload" >&2
  exit 2
fi

PARSED="$(node -e 'const p = JSON.parse(process.argv[1]||"{}"); if (!p.command || !Array.isArray(p.args)) process.exit(2); process.stdout.write(JSON.stringify(p));' "$PAYLOAD" 2>/dev/null || true)"
if [[ -z "$PARSED" ]]; then
  echo "[E_RUNNER_RUNTIME_FAILED] invalid payload" >&2
  exit 2
fi

COMMAND="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.command);' "$PARSED")"
STAGE="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.stage||"run"));' "$PARSED")"
ARGS_JSON="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify(p.args));' "$PARSED")"

WORKDIR="$(node -e '
const path=require("node:path");
const p=JSON.parse(process.argv[1]);
const fromArgs=(p.args||[]).map(String).find(v=>v.includes("/"));
const base=fromArgs?path.dirname(path.resolve(fromArgs)):path.dirname(path.resolve(String(p.command)));
process.stdout.write(base);
' "$PARSED")"

if [[ ! -d "$WORKDIR" ]]; then
  echo "[E_RUNNER_RUNTIME_FAILED] invalid workspace mount path" >&2
  exit 2
fi

CPU_LIMIT="${RUNNER_CPU_TIME_SECONDS:-2}"
MEM_KB="${RUNNER_MEMORY_LIMIT_KB:-262144}"
MEM_MB=$(( MEM_KB / 1024 ))
if (( MEM_MB < 128 )); then MEM_MB=128; fi
PIDS_LIMIT="${RUNNER_ISOLATED_PIDS_LIMIT:-64}"
IMAGE="${RUNNER_ISOLATED_IMAGE:-gcc:14}"
NETWORK_MODE="${RUNNER_ISOLATED_NETWORK_MODE:-none}"
WORK_MOUNT="/workspace"

# translate host absolute paths to container mount paths
CONTAINER_COMMAND="$COMMAND"
if [[ "$CONTAINER_COMMAND" == "$WORKDIR"* ]]; then
  CONTAINER_COMMAND="$WORK_MOUNT${CONTAINER_COMMAND#$WORKDIR}"
fi

CONTAINER_ARGS="$(node -e '
const p=JSON.parse(process.argv[1]);
const root=process.argv[2];
const mount=process.argv[3];
const out=(p.args||[]).map((v)=>{
  const s=String(v);
  return s.startsWith(root) ? `${mount}${s.slice(root.length)}` : s;
});
process.stdout.write(JSON.stringify(out));
' "$PARSED" "$WORKDIR" "$WORK_MOUNT")"

run_local_fallback() {
  echo "[runner-isolated] WARNING: docker unavailable, falling back to host execution" >&2
  node -e '
const {spawn}=require("node:child_process");
const cmd=process.argv[1];
const args=JSON.parse(process.argv[2]);
const child=spawn(cmd,args,{stdio:"inherit"});
child.on("exit",(code,signal)=>{ if(signal){ process.kill(process.pid, signal); } else { process.exit(code ?? 1); }});
child.on("error",()=>process.exit(127));
' "$COMMAND" "$ARGS_JSON"
}

if ! command -v docker >/dev/null 2>&1; then
  run_local_fallback
  exit $?
fi

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "[runner-isolated] pulling image: $IMAGE" >&2
  if ! docker pull "$IMAGE" >/dev/null 2>&1; then
    echo "[runner-isolated] WARNING: failed to pull $IMAGE, falling back to host execution" >&2
    run_local_fallback
    exit $?
  fi
fi

if ! docker run --rm \
  --network "$NETWORK_MODE" \
  --cpus "1.0" \
  --memory "${MEM_MB}m" \
  --memory-swap "${MEM_MB}m" \
  --pids-limit "$PIDS_LIMIT" \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  -u 65534:65534 \
  -v "$WORKDIR:$WORK_MOUNT:rw" \
  -w "$WORK_MOUNT" \
  "$IMAGE" \
  node -e '
const {spawn}=require("node:child_process");
const cmd=process.argv[1];
const args=JSON.parse(process.argv[2]);
const child=spawn(cmd,args,{stdio:"inherit"});
child.on("exit",(code)=>process.exit(code ?? 1));
child.on("error",()=>process.exit(127));
' "$CONTAINER_COMMAND" "$CONTAINER_ARGS"
then
  code=$?
  if [[ "$STAGE" == "compile" || "$STAGE" == "run" || "$STAGE" == "judge" ]]; then
    exit $code
  fi
  exit 1
fi
