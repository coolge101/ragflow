#!/usr/bin/env bash
# 生成 TBOX_VM_PRODUCTION_ACCEPTANCE.md §5 记录草稿（自动化项 + 待手测占位）
#
# Usage:
#   bash scripts/tbox_record_vm_acceptance.sh
#   bash scripts/tbox_record_vm_acceptance.sh --run-smoke   # 先跑完整 VM 验收
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_SMOKE=0
[[ "${1:-}" == "--run-smoke" ]] && RUN_SMOKE=1

HEAD="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
DATE="$(date +%Y-%m-%d)"
LAN="$(hostname -I 2>/dev/null | awk '{print $1}' || echo unknown)"
CONSOLE_PORT="${TBOX_CONSOLE_PORT:-5180}"

SMOKE_STATUS="not run"
LOGIN_STATUS="not run"
API="${TBOX_SMOKE_BASE_URL:-http://127.0.0.1:9380}"
if [[ "$RUN_SMOKE" -eq 1 ]]; then
  if bash scripts/tbox_vm_production_acceptance.sh; then
    SMOKE_STATUS="pass"
  else
    SMOKE_STATUS="FAIL"
  fi
else
  if bash scripts/tbox_verify_stack_image.sh >/dev/null 2>&1 \
    && curl -sf "${API}/v1/tbox/health" >/dev/null 2>&1 \
    && curl -sf "http://127.0.0.1:${CONSOLE_PORT}/login" >/dev/null 2>&1; then
    SMOKE_STATUS="quick-check ok (run tbox_vm_production_acceptance.sh for full)"
  else
    SMOKE_STATUS="quick-check FAIL"
  fi
fi

if bash scripts/tbox_login_smoke.sh >/dev/null 2>&1; then
  LOGIN_STATUS="pass"
else
  LOGIN_STATUS="FAIL"
fi

cat <<EOF
# 粘贴到 docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §5

| 项 | 值 |
|----|-----|
| 日期 | ${DATE} |
| VM / LAN IP | ${LAN} |
| Console | http://${LAN}:${CONSOLE_PORT}/login |
| Git HEAD | ${HEAD} |
| \`tbox_vm_production_acceptance.sh\` | ${SMOKE_STATUS} |
| \`tbox_login_smoke.sh\` | ${LOGIN_STATUS} |
| §3 A 本机登录 | $([[ "$LOGIN_STATUS" == "pass" ]] && echo "☑" || echo "☐ 待手测") |
| 双账号权限（§3 D） | ☐ 待手测 |
| UI Walkthrough Q + L–P（§4） | ☐ 待手测 |
| G1 向导 /documents（§4） | ☐ 待手测 |
| 备注 | |

手测清单：docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §3–4
Walkthrough 5180：docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md 步骤 Q
EOF
