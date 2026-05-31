#!/usr/bin/env bash
# Phase 16–17 手测完成后归档 §5（不代替浏览器验证）
#
# Usage:
#   bash scripts/tbox_archive_phase16_17_handtest.sh
# 建议先完成：bash scripts/tbox_phase16_17_handtest.sh 中的浏览器清单
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Archive Phase 16–17 hand-test to VM acceptance §5"
echo "    (assumes you completed Citation + /search highlight on 5180)"
echo ""

export TBOX_PHASE16_17_HANDTEST_DONE=1
bash scripts/tbox_record_vm_acceptance.sh --no-probe --write-section5

echo ""
echo "==> ARCHIVE OK — verify docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §5 Phase 16–17 row is ☑"
