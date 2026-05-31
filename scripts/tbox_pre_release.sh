#!/usr/bin/env bash
# TBOX 发版前门禁：web-tbox check → smoke suite → 钉扎 §5（可选完整 VM 7 步）
#
# Usage (repo root, Docker @ 9380 + tbox-console @ 5180):
#   bash scripts/tbox_pre_release.sh
#   TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh
#   TBOX_SKIP_WEB_TBOX_CHECK=1 bash scripts/tbox_pre_release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> TBOX pre-release @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo ""

if [[ "${TBOX_SKIP_WEB_TBOX_CHECK:-0}" != "1" ]]; then
  echo "==> [1/3] web-tbox check"
  bash scripts/tbox_web_tbox_check.sh
else
  echo "==> [1/3] SKIP web-tbox check (TBOX_SKIP_WEB_TBOX_CHECK=1)"
fi
echo ""

echo "==> [2/3] smoke suite + write VM §5"
TBOX_SKIP_WEB_TBOX_CHECK=1 bash scripts/tbox_record_vm_acceptance.sh --run-suite --write-section5
echo ""

if [[ "${TBOX_PRE_RELEASE_VM:-0}" == "1" ]]; then
  echo "==> [3/3] VM production acceptance (7 steps)"
  bash scripts/tbox_vm_production_acceptance.sh
  bash scripts/tbox_record_vm_acceptance.sh --run-smoke --write-section5
else
  echo "==> [3/3] SKIP full VM (set TBOX_PRE_RELEASE_VM=1 for 7-step acceptance)"
fi
echo ""

echo "==> PRE-RELEASE OK"
echo "    Remaining manual: Phase 16–17 UI — bash scripts/tbox_phase16_17_handtest.sh"
echo "    After hand-test: TBOX_PHASE16_17_HANDTEST_DONE=1 bash scripts/tbox_record_vm_acceptance.sh --no-probe --write-section5"
