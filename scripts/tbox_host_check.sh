#!/usr/bin/env bash
# 宿主机门禁：web-tbox check + scripts 纯 Python 单测（无需 Docker）
#
# Usage (repo root):
#   bash scripts/tbox_host_check.sh
#   TBOX_SKIP_WEB_TBOX_CHECK=1 bash scripts/tbox_host_check.sh
#   TBOX_SKIP_SCRIPTS_UNIT=1 bash scripts/tbox_host_check.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> TBOX host check @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo ""

if [[ "${TBOX_SKIP_WEB_TBOX_CHECK:-0}" != "1" ]]; then
  bash scripts/tbox_web_tbox_check.sh
else
  echo "==> SKIP web-tbox check (TBOX_SKIP_WEB_TBOX_CHECK=1)"
fi
echo ""

if [[ "${TBOX_SKIP_SCRIPTS_UNIT:-0}" != "1" ]]; then
  bash scripts/tbox_scripts_unit_check.sh
else
  echo "==> SKIP scripts unit (TBOX_SKIP_SCRIPTS_UNIT=1)"
fi
echo ""

echo "==> 5180 / pre_release 链（栈就绪后）: bash scripts/tbox_print_release_next_steps.sh"
echo ""
echo "==> HOST CHECK OK"
