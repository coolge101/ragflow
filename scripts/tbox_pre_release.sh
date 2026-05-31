#!/usr/bin/env bash
# TBOX 发版前门禁：host check → smoke suite 或 VM 7 步 → 钉扎 §5
#
# Usage (repo root, Docker @ 9380 + tbox-console @ 5180):
#   bash scripts/tbox_pre_release.sh
#   TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh
#   TBOX_SKIP_HOST_CHECK=1 bash scripts/tbox_pre_release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export TBOX_SMOKE_RUNNER="${TBOX_SMOKE_RUNNER:-docker}"

echo "==> TBOX pre-release @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo ""

if [[ "${TBOX_SKIP_HOST_CHECK:-0}" != "1" ]]; then
  echo "==> [1/2] host check (web-tbox + scripts unit)"
  bash scripts/tbox_host_check.sh
else
  echo "==> [1/2] SKIP host check (TBOX_SKIP_HOST_CHECK=1)"
fi
echo ""

if [[ "${TBOX_PRE_RELEASE_VM:-0}" == "1" ]]; then
  echo "==> [2/2] VM acceptance (7 steps) + write §5"
  TBOX_SKIP_WEB_TBOX_CHECK=1 TBOX_SKIP_SCRIPTS_UNIT=1 bash scripts/tbox_record_vm_acceptance.sh --run-smoke --write-section5
else
  echo "==> [2/2] smoke suite + write §5"
  TBOX_SKIP_WEB_TBOX_CHECK=1 TBOX_SKIP_SCRIPTS_UNIT=1 bash scripts/tbox_record_vm_acceptance.sh --run-suite --write-section5
  echo ""
  echo "    (full VM: TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh)"
fi
echo ""

echo "==> PRE-RELEASE OK"
echo "    Remaining manual: Phase 16–17 UI — bash scripts/tbox_phase16_17_handtest.sh"
echo "    After hand-test: bash scripts/tbox_archive_phase16_17_handtest.sh"
