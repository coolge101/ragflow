#!/usr/bin/env bash
# 5180 console bundle 冒烟：确认静态 JS 含 Phase 16–17 Citation / ChunkListPanel 代码
#
# Usage:
#   bash scripts/tbox_console_bundle_smoke.sh
#   TBOX_CONSOLE_URL=http://127.0.0.1:5180 bash scripts/tbox_console_bundle_smoke.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Console bundle smoke @ ${TBOX_CONSOLE_URL:-http://127.0.0.1:5180}"
python3 scripts/tbox_console_bundle_smoke.py | python3 -m json.tool
echo "==> CONSOLE BUNDLE SMOKE PASSED"
