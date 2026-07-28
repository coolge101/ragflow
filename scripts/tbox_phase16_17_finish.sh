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
  case "$arg" in
    --archive) ARCHIVE=1 ;;
  esac
done

bash scripts/tbox_phase16_17_handtest.sh

if [[ "$ARCHIVE" -eq 1 ]]; then
  echo ""
  bash scripts/tbox_archive_phase16_17_handtest.sh --confirm
  echo ""
  echo "    Doc: docs/TBOX_QUICKSTART.md §1.3 · docs/TBOX_SMOKE_ENV.md"
  echo "         docs/TBOX_SYSTEM_USER_MANUAL.md §5.4"
else
  echo ""
  echo "==> When Citation + /search highlight pass on 5180 (Walkthrough C §7 + D):"
  echo "    bash scripts/tbox_phase16_17_finish.sh --archive"
  echo "    Full chain: bash scripts/tbox_print_release_next_steps.sh"
  echo "    pre_release: bash scripts/tbox_pre_release.sh --help"
  echo "    Doc: docs/TBOX_QUICKSTART.md §1.3 · docs/TBOX_SYSTEM_USER_MANUAL.md §5.4"
  echo "         docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md (step D) · docs/TBOX_SMOKE_ENV.md"
fi
