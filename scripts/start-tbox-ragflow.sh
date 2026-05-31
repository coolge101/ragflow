#!/usr/bin/env bash
# 自动启动 TBOX 联调环境：Docker 依赖 + RAGFlow（与 docker/tbox-compose-up.sh 一致），可选启动 web-tbox。
#
# 用法:
#   ./scripts/start-tbox-ragflow.sh            # 仅后端（Compose）
#   ./scripts/start-tbox-ragflow.sh --web      # 后端 + web-tbox（npm run dev，端口 5174）
#   ./scripts/start-tbox-ragflow.sh --console  # 后端 + Docker 内生产静态 UI（nginx，默认 5180）
#   TBOX_START_WEB=1 ./scripts/start-tbox-ragflow.sh
#   TBOX_CONSOLE=1 ./scripts/start-tbox-ragflow.sh
#
# After --console (5180 quasi-production):
#   bash scripts/tbox_setup_smoke_env.sh
#   bash scripts/tbox_pre_release.sh --help
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WITH_WEB=0
WITH_CONSOLE=0
for a in "$@"; do
  case "$a" in
    --web) WITH_WEB=1 ;;
    --console) WITH_CONSOLE=1 ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
  esac
done
[[ "${TBOX_START_WEB:-0}" == "1" ]] && WITH_WEB=1
[[ "${TBOX_CONSOLE:-0}" == "1" ]] && WITH_CONSOLE=1

echo "==> [start-tbox-ragflow] repo: $REPO_ROOT"
if [[ "$WITH_CONSOLE" -eq 1 ]]; then
  export TBOX_CONSOLE=1
fi
bash "$REPO_ROOT/docker/tbox-compose-up.sh"

if [[ "$WITH_WEB" -eq 1 ]]; then
  WT="$REPO_ROOT/web-tbox"
  if [[ ! -d "$WT" ]]; then
    echo "web-tbox directory missing: $WT" >&2
    exit 1
  fi
  cd "$WT"
  if [[ ! -f .env ]] && [[ -f .env.example ]]; then
    echo "==> [start-tbox-ragflow] web-tbox: no .env — copy .env.example to .env and edit if needed"
    cp -n .env.example .env 2>/dev/null || true
  fi
  if [[ ! -d node_modules ]]; then
    echo "==> [start-tbox-ragflow] web-tbox: npm install"
    npm install
  fi
  if curl -sf -m 1 "http://127.0.0.1:5174/" >/dev/null 2>&1; then
    echo "==> [start-tbox-ragflow] web-tbox: already responding on http://127.0.0.1:5174"
  else
    LOG="$WT/vite-dev.log"
    echo "==> [start-tbox-ragflow] web-tbox: starting npm run dev (log: $LOG)"
    nohup npm run dev >>"$LOG" 2>&1 &
    echo "==> [start-tbox-ragflow] web-tbox: npm run dev in background (log: $LOG) — open http://127.0.0.1:5174"
  fi
fi

if [[ "$WITH_CONSOLE" -eq 1 || "${TBOX_CONSOLE:-0}" == "1" ]]; then
  echo ""
  echo "==> [start-tbox-ragflow] quasi-production (5180 console):"
  echo "    Console: http://127.0.0.1:\${TBOX_CONSOLE_PORT:-5180}/login"
  echo "    bash scripts/tbox_setup_smoke_env.sh"
  echo "    bash scripts/tbox_pre_release.sh --help"
  echo "    bash scripts/tbox_pre_release.sh"
  echo "    bash scripts/tbox_vm_production_acceptance.sh"
  echo "    # Phase 16–17 browser: bash scripts/tbox_phase16_17_finish.sh --archive"
  echo "    Doc: docs/TBOX_DEPLOY_RUNBOOK.md §8.1"
fi

echo "==> [start-tbox-ragflow] done."
