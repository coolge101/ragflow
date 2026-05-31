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
