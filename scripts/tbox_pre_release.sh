#!/usr/bin/env bash
# TBOX 发版前门禁：host check → smoke suite 或 VM 7 步 → 钉扎 §5
#
# Usage (repo root, Docker @ 9380 + tbox-console @ 5180):
#   bash scripts/tbox_pre_release.sh
#   TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh
#   TBOX_SKIP_HOST_CHECK=1 bash scripts/tbox_pre_release.sh
#   TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_pre_release.sh
#   bash scripts/tbox_pre_release.sh --help
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
TBOX pre-release gate (repo root; Docker @ 9380 + tbox-console @ 5180)

Steps:
  [1/2] host check — web-tbox typecheck/test/build + scripts unit (unless skipped)
  [2/2] smoke suite OR VM 7-step + write docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §5

Mode matrix (env vars):

| 模式 | 命令 | [1/2] | [2/2] | 双账号 |
|------|------|-------|-------|--------|
| 默认（发版前） | bash scripts/tbox_pre_release.sh | host check | smoke suite + §5 | 可选 |
| 完整 VM | TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh | host check | VM 7-step + §5 | 可选 |
| 跳过 host | TBOX_SKIP_HOST_CHECK=1 bash scripts/tbox_pre_release.sh | skip | smoke suite + §5 | 可选 |
| 强制双账号 | TBOX_REQUIRE_DUAL_ACCOUNT=1 bash scripts/tbox_pre_release.sh | host check | suite + §5 | 必填 |
| post-merge | TBOX_SKIP_WEB_TBOX_CHECK=1 TBOX_PRE_RELEASE_VM=1 … | (post-merge 已跑 host) | VM + §5 | 可选 |

组合示例:
  TBOX_SKIP_HOST_CHECK=1 TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh
  TBOX_REQUIRE_DUAL_ACCOUNT=1 TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh

After pre_release pass (§5 automation ☑; Phase 16–17 UI still ☐):

  1. bash scripts/tbox_phase16_17_handtest.sh
  2. Browser: Walkthrough step C §7 + D on 5180
     Optional review: /review/step/phase16-17
  3. bash scripts/tbox_phase16_17_finish.sh --archive

Full release chain: bash scripts/tbox_print_release_next_steps.sh

See: docs/TBOX_SMOKE_SCRIPTS.md (Phase 16–17 section) · docs/TBOX_SMOKE_ENV.md
EOF
  exit 0
fi

export TBOX_SMOKE_RUNNER="${TBOX_SMOKE_RUNNER:-docker}"

echo "==> TBOX pre-release @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo ""

if [[ "${TBOX_REQUIRE_DUAL_ACCOUNT:-0}" == "1" ]]; then
  echo "    dual-account: required (TBOX_REQUIRE_DUAL_ACCOUNT=1)"
fi
echo ""

if [[ "${TBOX_SKIP_HOST_CHECK:-0}" != "1" ]]; then
  echo "==> [1/2] host check (web-tbox + scripts unit)"
  bash scripts/tbox_host_check.sh
else
  echo "==> [1/2] SKIP host check (TBOX_SKIP_HOST_CHECK=1)"
fi
echo ""

if [[ "${TBOX_PRE_RELEASE_VM:-0}" == "1" ]]; then
  echo "==> [2/2] VM acceptance (7 steps) + write §5"
  TBOX_SKIP_WEB_TBOX_CHECK=1 TBOX_SKIP_SCRIPTS_UNIT=1 bash scripts/tbox_record_vm_acceptance.sh --run-smoke --write-section5
else
  echo "==> [2/2] smoke suite + write §5"
  TBOX_SKIP_WEB_TBOX_CHECK=1 TBOX_SKIP_SCRIPTS_UNIT=1 bash scripts/tbox_record_vm_acceptance.sh --run-suite --write-section5
  echo ""
  echo "    (full VM: TBOX_PRE_RELEASE_VM=1 bash scripts/tbox_pre_release.sh)"
fi
echo ""

echo "==> PRE-RELEASE OK"
echo "    Remaining manual (VM §5 Phase 16–17 still ☐):"
echo "    1. bash scripts/tbox_phase16_17_handtest.sh"
echo "    2. Browser C §7 + D on 5180 (optional /review/step/phase16-17)"
echo "    3. bash scripts/tbox_phase16_17_finish.sh --archive"
echo "    Full chain: bash scripts/tbox_print_release_next_steps.sh"
