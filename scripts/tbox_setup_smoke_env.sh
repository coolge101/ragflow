#!/usr/bin/env bash
# 初始化 scripts/tbox_smoke.env（从 example 复制）并校验双账号配置
#
# Usage:
#   bash scripts/tbox_setup_smoke_env.sh
#   bash scripts/tbox_setup_smoke_env.sh --check-only
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

_print_release_next_steps_hint() {
  echo "    bash scripts/tbox_pre_release.sh --help"
  echo "    bash scripts/tbox_pre_release.sh"
  echo "    Full chain: bash scripts/tbox_print_release_next_steps.sh"
  echo "    Doc: docs/TBOX_DEPLOY_RUNBOOK.md §3.1.3 · docs/TBOX_SMOKE_ENV.md"
}

CHECK_ONLY=0
[[ "${1:-}" == "--check-only" ]] && CHECK_ONLY=1

ENV_FILE="${ROOT}/scripts/tbox_smoke.env"
EXAMPLE="${ROOT}/scripts/tbox_smoke.env.example"

if [[ "$CHECK_ONLY" -eq 0 && ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE" "$ENV_FILE"
  echo "==> Created ${ENV_FILE} from example"
  echo "    Edit TBOX_SMOKE_NORMAL_EMAIL / TBOX_SMOKE_NORMAL_PASSWORD for dual-account tests"
  echo ""
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: missing ${ENV_FILE}" >&2
  echo "  Run: bash scripts/tbox_setup_smoke_env.sh" >&2
  exit 1
fi

if bash scripts/tbox_dual_account_check.sh; then
  echo ""
  echo "==> SMOKE ENV OK (dual-account configured)"
  echo "    TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_pre_release.sh"
  _print_release_next_steps_hint
  exit 0
fi

echo ""
echo "==> SMOKE ENV: admin-only mode (dual-account optional)"
echo "    1. Edit ${ENV_FILE}"
echo "    2. Set TBOX_SMOKE_NORMAL_EMAIL and TBOX_SMOKE_NORMAL_PASSWORD"
echo "    3. Re-run: bash scripts/tbox_setup_smoke_env.sh --check-only"
echo "    Doc: docs/TBOX_SMOKE_ENV.md"
_print_release_next_steps_hint
exit 0
