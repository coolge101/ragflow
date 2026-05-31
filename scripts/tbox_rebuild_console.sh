#!/usr/bin/env bash
# 重建 5180 tbox-console 镜像并 force-recreate（Phase 16–17 UI 变更后必跑）
#
# Usage (repo root):
#   bash scripts/tbox_rebuild_console.sh
#   TBOX_SKIP_WEB_TBOX_CHECK=1 bash scripts/tbox_rebuild_console.sh   # 跳过宿主机 npm 检查
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONSOLE_PORT="${TBOX_CONSOLE_PORT:-5180}"
CONSOLE_URL="${TBOX_CONSOLE_URL:-http://127.0.0.1:${CONSOLE_PORT}}"

echo "==> TBOX rebuild tbox-console @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "    Target: ${CONSOLE_URL}/login"
echo ""

if [[ "${TBOX_SKIP_WEB_TBOX_CHECK:-0}" != "1" ]]; then
  echo "==> [1/3] Host web-tbox check (typecheck + test + build)"
  bash scripts/tbox_web_tbox_check.sh
else
  echo "==> [1/3] SKIP host web-tbox check (TBOX_SKIP_WEB_TBOX_CHECK=1)"
fi
echo ""

echo "==> [2/3] Docker build tbox-console image"
cd "$ROOT/docker"
docker compose -f docker-compose.yml --profile tbox-console build tbox-console
echo ""

echo "==> [3/3] Force-recreate tbox-console container"
docker compose -f docker-compose.yml --profile cpu --profile tbox-console up -d --force-recreate tbox-console
echo ""

sleep 2
if curl -sf -o /dev/null -m 15 "${CONSOLE_URL}/login"; then
  echo "OK: ${CONSOLE_URL}/login"
else
  echo "FAIL: console not reachable at ${CONSOLE_URL}/login" >&2
  exit 1
fi

echo ""
cd "$ROOT"
echo "==> Console bundle smoke (Phase 16–17 markers)"
bash scripts/tbox_console_bundle_smoke.sh

echo ""
echo "==> CONSOLE REBUILD OK"
echo "Next: hand-test Phase 16–17 on ${CONSOLE_URL} (Citation + /search highlight)"
echo "    Review: ${CONSOLE_URL}/review/step/phase16-17"
echo "    bash scripts/tbox_phase16_17_handtest.sh"
echo "    bash scripts/tbox_phase16_17_finish.sh --archive"
echo "    Full chain: bash scripts/tbox_print_release_next_steps.sh"
echo "Doc: docs/TBOX_CONSOLE_REBUILD.md"
