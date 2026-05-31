#!/usr/bin/env bash
# Phase 16–17 手测收尾：打印清单 → 可选归档 §5
#
# Usage:
#   bash scripts/tbox_phase16_17_finish.sh
#   bash scripts/tbox_phase16_17_finish.sh --archive    # 浏览器手测完成后
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ARCHIVE=0
for arg in "$@"; do
  case "$arg in
    --archive) ARCHIVE=1 ;;
  esac
done

bash scripts/tbox_phase16_17_handtest.sh

if [[ "$ARCHIVE" -eq 1 ]]; then
  echo ""
  bash scripts/tbox_archive_phase16_17_handtest.sh --confirm
fi
