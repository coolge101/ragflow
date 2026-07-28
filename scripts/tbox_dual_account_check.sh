#!/usr/bin/env bash
# 检查 scripts/tbox_smoke.env 是否已配置双账号（TBOX_SMOKE_NORMAL_*）
#
# Usage:
#   bash scripts/tbox_dual_account_check.sh
#   TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_permissions_smoke.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/tbox_load_smoke_env.sh
source "$ROOT/scripts/tbox_load_smoke_env.sh"
_tbox_load_smoke_env "$ROOT"

ENV_FILE="${ROOT}/scripts/tbox_smoke.env"
has_email=0
has_pass=0
[[ -n "${TBOX_SMOKE_NORMAL_EMAIL:-}" ]] && has_email=1
[[ -n "${TBOX_SMOKE_NORMAL_PASSWORD:-}" ]] && has_pass=1

if [[ "$has_email" -eq 1 && "$has_pass" -eq 1 ]]; then
  echo "OK: dual-account env configured (${TBOX_SMOKE_NORMAL_EMAIL})"
  exit 0
fi

if [[ "$has_email" -eq 1 || "$has_pass" -eq 1 ]]; then
  echo "FAIL: partial dual-account config — set BOTH TBOX_SMOKE_NORMAL_EMAIL and TBOX_SMOKE_NORMAL_PASSWORD" >&2
  echo "      See docs/TBOX_SMOKE_ENV.md" >&2
  exit 1
fi

echo "FAIL: dual-account not configured" >&2
echo "  1. cp scripts/tbox_smoke.env.example scripts/tbox_smoke.env" >&2
echo "  2. Fill TBOX_SMOKE_NORMAL_EMAIL / TBOX_SMOKE_NORMAL_PASSWORD" >&2
if [[ ! -f "$ENV_FILE" ]]; then
  echo "  (missing ${ENV_FILE})" >&2
fi
echo "  Doc: docs/TBOX_SMOKE_ENV.md" >&2
exit 1
