#!/usr/bin/env bash
# 一键：Docker 依赖 + 从本仓库构建并启动含 TBOX 的 RAGFlow，然后提示打开 web-tbox。
# 在仓库根目录执行:  bash scripts/tbox-up.sh
# 5180 准生产: TBOX_CONSOLE=1 bash scripts/tbox-up.sh
# 国内网络: TBOX_CHINA_DOWNLOAD=1 bash scripts/tbox-up.sh
# 跳过 Chrome 大包（镜像内浏览器自动化不可用）: NO_CHROME_DOWNLOAD=1
# NLTK 仍失败: SKIP_NLTK_DOWNLOAD=1（不推荐）
# 分步（下载 / deps 镜像 / 主镜像）: bash scripts/tbox-deps-step-by-step.sh help
# 跳过 text_concat_xgb Hub 模型: RAGFLOW_DISABLE_TEXT_CONCAT_XGB=1（写入 docker/.env 以便容器内生效）
#
# After TBOX_CONSOLE=1:
#   bash scripts/tbox_setup_smoke_env.sh
#   bash scripts/tbox_pre_release.sh --help
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$ROOT/docker/tbox-compose-up.sh"
echo ""
echo "==> API: curl -sf http://127.0.0.1:\${SVR_HTTP_PORT:-9380}/v1/tbox/health"
echo ""
echo "==> 下一步：前端（任选其一）"
echo "    Dev 5174:  cd $ROOT/web-tbox && npm run dev"
echo "    或:        bash $ROOT/scripts/start-tbox-ui-review.sh"
echo "    5180 准生产: bash $ROOT/scripts/start-tbox-ragflow.sh --console"
echo "                 （栈已起时: TBOX_CONSOLE=1 bash docker/tbox-compose-up.sh）"
if [[ "${TBOX_CONSOLE:-0}" == "1" ]]; then
  echo ""
  echo "==> Quasi-production (5180 console):"
  echo "    Console: http://127.0.0.1:\${TBOX_CONSOLE_PORT:-5180}/login"
  echo "    bash scripts/tbox_setup_smoke_env.sh"
  echo "    bash scripts/tbox_pre_release.sh --help"
  echo "    bash scripts/tbox_pre_release.sh"
  echo "    # Phase 16–17: bash scripts/tbox_phase16_17_finish.sh --archive"
  echo "    Doc: docs/TBOX_DEPLOY_RUNBOOK.md §8.1"
fi
echo ""
echo "    浏览器登录后进入「用户与角色」即可管理成员、角色与初始密码。"
