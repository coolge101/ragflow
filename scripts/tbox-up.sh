#!/usr/bin/env bash
# 一键：Docker 依赖 + 从本仓库构建并启动含 TBOX 的 RAGFlow，然后提示打开 web-tbox。
# 在仓库根目录执行:  bash scripts/tbox-up.sh
# 国内网络: TBOX_CHINA_DOWNLOAD=1 bash scripts/tbox-up.sh
# 跳过 Chrome 大包（镜像内浏览器自动化不可用）: NO_CHROME_DOWNLOAD=1
# NLTK 仍失败: SKIP_NLTK_DOWNLOAD=1（不推荐）
# 分步（下载 / deps 镜像 / 主镜像）: bash scripts/tbox-deps-step-by-step.sh help
# 跳过 text_concat_xgb Hub 模型: RAGFLOW_DISABLE_TEXT_CONCAT_XGB=1（写入 docker/.env 以便容器内生效）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$ROOT/docker/tbox-compose-up.sh"
echo ""
echo "==> 下一步：在另一终端启动前端（任选其一）"
echo "    bash $ROOT/scripts/start-tbox-ui-review.sh"
echo "    或:  cd $ROOT/web-tbox && npm run dev"
echo "    浏览器打开登录页后进入「用户与角色」即可管理成员、角色与初始密码。"
