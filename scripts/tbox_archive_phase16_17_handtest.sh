#!/usr/bin/env bash
# Phase 16–17 手测完成后归档 §5（不代替浏览器验证）
#
# Usage:
#   bash scripts/tbox_archive_phase16_17_handtest.sh --confirm
# 建议先完成：bash scripts/tbox_phase16_17_handtest.sh 中的浏览器清单
# 或一键：bash scripts/tbox_phase16_17_finish.sh --archive
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONFIRM=0
for arg in "$@"; do
  case "$arg" in
    --confirm) CONFIRM=1 ;;
  esac
done
if [[ "${TBOX_PHASE16_17_CONFIRM:-0}" == "1" ]]; then
  CONFIRM=1
fi

if [[ "$CONFIRM" -ne 1 ]]; then
  echo "FAIL: browser hand-test not confirmed" >&2
  echo "  After Citation + /search highlight on 5180, re-run with:" >&2
  echo "    bash scripts/tbox_archive_phase16_17_handtest.sh --confirm" >&2
  echo "  Or: bash scripts/tbox_phase16_17_finish.sh --archive" >&2
  exit 1
fi

echo "==> Archive Phase 16–17 hand-test to VM acceptance §5"
echo "    (assumes you completed Citation + /search highlight on 5180)"
echo ""

if [[ "${TBOX_SKIP_CONSOLE_BUNDLE_SMOKE:-0}" != "1" ]]; then
  echo "==> Console bundle smoke (5180 must not be stale)"
  bash scripts/tbox_console_bundle_smoke.sh
  echo ""
else
  echo "==> SKIP console bundle (TBOX_SKIP_CONSOLE_BUNDLE_SMOKE=1)"
  echo ""
fi

export TBOX_PHASE16_17_HANDTEST_DONE=1
bash scripts/tbox_record_vm_acceptance.sh --no-probe --write-section5

echo ""
echo "==> ARCHIVE OK — verify docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §5 Phase 16–17 row is ☑"
