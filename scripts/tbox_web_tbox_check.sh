#!/usr/bin/env bash
# web-tbox 门禁：typecheck → test → build（与 web-tbox.yml / post-merge 一致）
#
# Usage (repo root):
#   bash scripts/tbox_web_tbox_check.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/web-tbox"

echo "==> web-tbox typecheck"
npm run typecheck
echo ""
echo "==> web-tbox test"
npm test
echo ""
echo "==> web-tbox build"
npm run build
echo ""
echo "==> WEB-TBOX CHECK OK"
