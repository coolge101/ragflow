#!/usr/bin/env bash
# 一键启动 TBOX 验收环境：Docker 依赖 + RAGFlow API + web-tbox（Vite），便于浏览器登录对照界面预期。
#
# 用法:
#   ./scripts/start-tbox-ui-review.sh              # 后端 + 后台启动 Vite（日志 web-tbox/vite-dev.log）
#   ./scripts/start-tbox-ui-review.sh --foreground # 仅拉起后端，然后前台运行 npm run dev（Ctrl+C 只停前端）
#   TBOX_OPEN_BROWSER=1 ./scripts/start-tbox-ui-review.sh   # 结束后尝试用系统默认浏览器打开登录页
#   ./scripts/start-tbox-ui-review.sh -h
#
# 前置: docker/.env；后端需含 TBOX（推荐先执行: bash scripts/tbox-up.sh）；Node >=18.20.4；npm install 由脚本按需执行。
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FOREGROUND=0
for a in "$@"; do
  case "$a" in
    --foreground|-f) FOREGROUND=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
  esac
done

if [[ ! -f "$REPO_ROOT/docker/.env" ]]; then
  echo "缺少 $REPO_ROOT/docker/.env — 请先: cp docker/.env.example docker/.env 并按说明修改" >&2
  exit 1
fi

API_PORT=9380
set -a
# shellcheck disable=SC1091
source "$REPO_ROOT/docker/.env"
set +a
API_PORT="${SVR_HTTP_PORT:-9380}"

echo "==> [start-tbox-ui-review] 仓库: $REPO_ROOT"

if [[ "$FOREGROUND" -eq 1 ]]; then
  bash "$REPO_ROOT/docker/tbox-compose-up.sh"
  WT="$REPO_ROOT/web-tbox"
  cd "$WT"
  if [[ ! -f .env ]] && [[ -f .env.example ]]; then
    cp -n .env.example .env 2>/dev/null || true
    echo "已创建 web-tbox/.env（来自 .env.example），若 API 不在本机 ${API_PORT} 请编辑 VITE_RAGFLOW_API_ORIGIN"
  fi
  if [[ ! -d node_modules ]]; then
    echo "==> web-tbox: npm install"
    npm install
  fi
  echo ""
  echo "------------------------------------------------------------------"
  echo "  浏览器打开:  http://127.0.0.1:5174/login"
  echo "  账号: RAGFlow 用户邮箱 + 密码（与官方一致，开发见 web-tbox/.env.example）"
  echo "  API: http://127.0.0.1:${API_PORT}  （Vite 会把 /api、/v1 代理到 VITE_RAGFLOW_API_ORIGIN）"
  echo "  按 Ctrl+C 结束当前终端中的 Vite；Docker 栈仍在运行。"
  echo "------------------------------------------------------------------"
  echo ""
  exec npm run dev
fi

bash "$REPO_ROOT/scripts/start-tbox-ragflow.sh" --web

LAN_IP=""
if command -v hostname >/dev/null 2>&1; then
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi

echo ""
echo "=================================================================="
echo "  TBOX 界面验收"
echo "=================================================================="
echo "  登录页:     http://127.0.0.1:5174/login"
if [[ -n "$LAN_IP" && "$LAN_IP" != "127.0.0.1" ]]; then
  echo "  （局域网）  http://${LAN_IP}:5174/login"
fi
echo "  后端 API:   http://127.0.0.1:${API_PORT}"
echo "  Vite 日志:  $REPO_ROOT/web-tbox/vite-dev.log"
echo ""
echo "  若登录或 /v1/tbox/me 异常: 确认镜像含 TBOX（见 docs/TBOX_DEPLOY_RUNBOOK.md §1.1）"
echo "  停止 Vite:   查占用 5174 的进程后结束（例: ss -lptn 'sport = :5174' 或 lsof -i :5174）"
echo "  停止 Docker: cd docker && docker compose -f docker-compose.yml down（并视情况停 docker-compose-base）"
echo "=================================================================="

if [[ "${TBOX_OPEN_BROWSER:-0}" == "1" ]]; then
  URL="http://127.0.0.1:5174/login"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
  fi
fi
