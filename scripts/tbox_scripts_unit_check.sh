#!/usr/bin/env bash
# TBOX scripts 纯 Python 单测（无需 Docker）
#
# Usage:
#   bash scripts/tbox_scripts_unit_check.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> TBOX scripts unit check"
python3 test/unit_test/scripts/test_tbox_console_bundle_smoke.py -q
echo "==> SCRIPTS UNIT CHECK OK"
