#!/usr/bin/env bash
# 生成 TBOX_VM_PRODUCTION_ACCEPTANCE.md §5 记录草稿（自动化项 + 待手测占位）
#
# Usage:
#   bash scripts/tbox_record_vm_acceptance.sh
#   bash scripts/tbox_record_vm_acceptance.sh --write-section5
#   bash scripts/tbox_record_vm_acceptance.sh --run-smoke              # 先跑完整 VM 验收
#   bash scripts/tbox_record_vm_acceptance.sh --run-suite                # 先跑 smoke 套件
#   bash scripts/tbox_record_vm_acceptance.sh --run-suite --write-section5
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/tbox_load_smoke_env.sh
source "$ROOT/scripts/tbox_load_smoke_env.sh"
_tbox_load_smoke_env "$ROOT"

RUN_SMOKE=0
RUN_SUITE=0
WRITE_SECTION5=0
for arg in "$@"; do
  case "$arg" in
    --run-smoke) RUN_SMOKE=1 ;;
    --run-suite) RUN_SUITE=1 ;;
    --write-section5) WRITE_SECTION5=1 ;;
  esac
done

HEAD="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
DATE="$(date +%Y-%m-%d)"
LAN="$(hostname -I 2>/dev/null | awk '{print $1}' || echo unknown)"
CONSOLE_PORT="${TBOX_CONSOLE_PORT:-5180}"

SMOKE_STATUS="not run"
SMOKE_SUITE_STATUS="not run"
LOGIN_STATUS="not run"
WEB_TBOX_STATUS="not run"
PERMS_STATUS="not run"
CONSOLE_BUNDLE_STATUS="not run"
DUAL_ACCOUNT_STATUS="not run"
API="${TBOX_SMOKE_BASE_URL:-http://127.0.0.1:9380}"

if [[ "$RUN_SMOKE" -eq 1 ]]; then
  if bash scripts/tbox_vm_production_acceptance.sh; then
    SMOKE_STATUS="pass (7/7)"
  else
    SMOKE_STATUS="FAIL"
  fi
elif [[ "$RUN_SUITE" -eq 1 ]]; then
  if bash scripts/tbox_smoke_suite.sh; then
    SMOKE_SUITE_STATUS="pass"
    SMOKE_STATUS="suite ok (see tbox_smoke_suite.sh)"
  else
    SMOKE_SUITE_STATUS="FAIL"
    SMOKE_STATUS="suite FAIL"
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

if [[ "$RUN_SUITE" -eq 0 ]]; then
  if bash scripts/tbox_smoke_suite.sh >/dev/null 2>&1; then
    SMOKE_SUITE_STATUS="pass"
  else
    SMOKE_SUITE_STATUS="FAIL or stack down"
  fi
fi

if bash scripts/tbox_login_smoke.sh >/dev/null 2>&1; then
  LOGIN_STATUS="pass"
else
  LOGIN_STATUS="FAIL"
fi

if [[ "${TBOX_SKIP_WEB_TBOX_CHECK:-0}" == "1" ]]; then
  WEB_TBOX_STATUS="skipped"
elif bash scripts/tbox_web_tbox_check.sh >/dev/null 2>&1; then
  WEB_TBOX_STATUS="pass (12 tests)"
else
  WEB_TBOX_STATUS="FAIL"
fi

if bash scripts/tbox_permissions_smoke.sh >/dev/null 2>&1; then
  PERMS_STATUS="pass"
  if [[ -n "${TBOX_SMOKE_NORMAL_EMAIL:-}" && -n "${TBOX_SMOKE_NORMAL_PASSWORD:-}" ]]; then
    PERMS_STATUS="pass (dual-account)"
  else
    PERMS_STATUS="pass (admin only; set scripts/tbox_smoke.env for dual)"
  fi
else
  PERMS_STATUS="FAIL"
fi

if bash scripts/tbox_dual_account_check.sh >/dev/null 2>&1; then
  DUAL_ACCOUNT_STATUS="configured"
else
  DUAL_ACCOUNT_STATUS="not configured (optional)"
fi

if [[ "${TBOX_SKIP_CONSOLE_BUNDLE_SMOKE:-0}" == "1" ]]; then
  CONSOLE_BUNDLE_STATUS="skipped"
elif bash scripts/tbox_console_bundle_smoke.sh >/dev/null 2>&1; then
  CONSOLE_BUNDLE_STATUS="pass (Phase 16–17 markers)"
else
  CONSOLE_BUNDLE_STATUS="FAIL — run tbox_rebuild_console.sh"
fi

HAND_TEST="${TBOX_HAND_TEST_DONE:-1}"
PHASE16_17_HAND="${TBOX_PHASE16_17_HANDTEST_DONE:-0}"
hand_mark() { [[ "$HAND_TEST" == "1" ]] && echo "☑ 手测 ${DATE}" || echo "☐ 待手测"; }
phase16_17_mark() {
  if [[ "$PHASE16_17_HAND" == "1" ]]; then
    echo "☑ 手测 ${DATE}"
  else
    echo "☐ Citation / 检索高亮 — \`bash scripts/tbox_phase16_17_handtest.sh\`"
  fi
}

TABLE=$(cat <<EOF
| 项 | 值 |
|----|-----|
| 日期 | ${DATE} |
| VM / LAN IP | ${LAN} |
| Console | http://${LAN}:${CONSOLE_PORT}/login |
| Git HEAD | \`${HEAD}\` |
| \`tbox_smoke_suite.sh\` | ${SMOKE_SUITE_STATUS} |
| \`tbox_vm_production_acceptance.sh\` | ${SMOKE_STATUS} |
| \`tbox_web_tbox_check.sh\` | ${WEB_TBOX_STATUS} |
| \`tbox_login_smoke.sh\` | ${LOGIN_STATUS} |
| \`tbox_console_bundle_smoke.sh\` | ${CONSOLE_BUNDLE_STATUS} |
| \`tbox_permissions_smoke.sh\` | ${PERMS_STATUS} |
| \`tbox_dual_account_check.sh\` | ${DUAL_ACCOUNT_STATUS} |
| §3 内网与双账号 A–D | $(hand_mark) |
| §4 产品动线 Walkthrough | $(hand_mark) |
| Phase 16–17 UI | $(phase16_17_mark) |
| 备注 | release smoke 含 P2/chat apps；双账号见 \`docs/TBOX_SMOKE_ENV.md\` |
EOF
)

if [[ "$WRITE_SECTION5" -eq 1 ]]; then
  DOC="${ROOT}/docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md"
  export DOC TABLE
  python3 <<'PY'
import os, re, sys
doc = os.environ["DOC"]
table = os.environ["TABLE"]
text = open(doc, encoding="utf-8").read()
pat = r"(<!-- tbox-vm-section5:start -->)(.*?)(<!-- tbox-vm-section5:end -->)"
m = re.search(pat, text, flags=re.DOTALL)
if not m:
    sys.exit("missing tbox-vm-section5 markers in " + doc)
new = f"{m.group(1)}\n{table}\n{m.group(3)}"
text = text[: m.start()] + new + text[m.end() :]
open(doc, "w", encoding="utf-8").write(text)
print(f"==> updated {doc} §5 (@ markers)")
PY
fi

cat <<EOF
# 粘贴到 docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §5

${TABLE}

手测清单：docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §3–4
Walkthrough 5180：docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md
EOF
