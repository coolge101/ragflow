#!/usr/bin/env bash
# TBOX scripts 纯 Python 单测（无需 Docker）
#
# Usage:
#   bash scripts/tbox_scripts_unit_check.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> TBOX scripts unit check"
python3 -m unittest discover -s test/unit_test/scripts -p 'test_*.py' -q
echo "==> SCRIPTS UNIT CHECK OK"
