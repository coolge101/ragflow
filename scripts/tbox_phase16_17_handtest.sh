#!/usr/bin/env bash
# Phase 16–17 5180 手测辅助：bundle 自动化通过后打印 Citation / 检索高亮检查清单
#
# Usage:
#   bash scripts/tbox_phase16_17_handtest.sh
#   TBOX_CONSOLE_URL=http://127.0.0.1:5180 bash scripts/tbox_phase16_17_handtest.sh
# 手测完成后生成 §5 草稿：
#   TBOX_PHASE16_17_HANDTEST_DONE=1 bash scripts/tbox_record_vm_acceptance.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONSOLE_PORT="${TBOX_CONSOLE_PORT:-5180}"
CONSOLE_URL="${TBOX_CONSOLE_URL:-http://127.0.0.1:${CONSOLE_PORT}}"
LAN="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"

echo "==> Phase 16–17 hand-test helper @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "    Console: ${CONSOLE_URL}"
[[ -n "${LAN}" ]] && echo "    LAN:     http://${LAN}:${CONSOLE_PORT}"
echo ""

echo "==> [1/2] Console bundle smoke (must pass before UI hand-test)"
bash scripts/tbox_console_bundle_smoke.sh
echo ""

echo "==> [2/2] Manual checklist (5180 — see docs/TBOX_UI_ACCEPTANCE_WALKTHROUGH.md §C/§G)"
cat <<EOF

┌─ Phase 16：Citation 侧栏联动 ─────────────────────────────────────
│ 1. 打开 ${CONSOLE_URL}/login ，admin 登录
│ 2. 进入 ${CONSOLE_URL}/ ，选择已绑定知识库的对话应用
│ 3. 提问直至回答含 [ID:0] 等引用标记
│ 4. 点击 [ID:n] → 右侧「本轮引用」对应片段高亮并滚动
│ 5. 点击侧栏片段 → 正文引用编号反向高亮
└──────────────────────────────────────────────────────────────────

┌─ Phase 17：检索结果高亮 ─────────────────────────────────────────
│ 1. 打开 ${CONSOLE_URL}/search
│ 2. 选择有内容的知识库，输入可命中关键词并检索
│ 3. 点击某条结果 → 条目高亮（scrollIntoView）
└──────────────────────────────────────────────────────────────────

通过后：
  1. 更新 docs/TBOX_VM_PRODUCTION_ACCEPTANCE.md §5「Phase 16–17 UI」为 ☑
  2. TBOX_PHASE16_17_HANDTEST_DONE=1 bash scripts/tbox_record_vm_acceptance.sh

EOF

echo "==> HAND-TEST CHECKLIST PRINTED"
