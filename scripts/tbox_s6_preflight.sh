#!/usr/bin/env bash
# S6 merge 前例行：fetch upstream tip + 打印漂移快照（可选写入 Runbook §5）
#
# Usage:
#   bash scripts/tbox_s6_preflight.sh
#   bash scripts/tbox_s6_preflight.sh --write-runbook
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WRITE_RUNBOOK=0
for arg in "$@"; do
  case "$arg" in
    --write-runbook) WRITE_RUNBOOK=1 ;;
  esac
done

echo "==> TBOX S6 preflight @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo ""

ARGS=(--fetch)
if [[ "$WRITE_RUNBOOK" -eq 1 ]]; then
  ARGS+=(--write-runbook)
fi

bash scripts/tbox_record_upstream_drift.sh "${ARGS[@]}"
echo ""
echo "==> S6 PREFLIGHT OK"
echo "    After merge: bash scripts/tbox_post_upstream_merge.sh"
echo "    Phase 16–17 (VM §5 may still be ☐ after post-merge):"
echo "    bash scripts/tbox_phase16_17_handtest.sh"
echo "    bash scripts/tbox_phase16_17_finish.sh --archive"
echo "    Full chain: bash scripts/tbox_print_release_next_steps.sh"
echo "    Doc: docs/TBOX_UPSTREAM_MERGE_RUNBOOK.md §3.2 · docs/TBOX_DEPLOY_FROM_GITHUB.md §6"
echo "         docs/TBOX_QUICKSTART.md §1.3 · docs/TBOX_DEPLOY_RUNBOOK.md §8.1"
