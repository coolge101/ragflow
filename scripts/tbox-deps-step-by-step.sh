#!/usr/bin/env bash
# 分步准备「含 TBOX 的 Docker 镜像」所需依赖（适合网络不稳定时一段段执行）。
# 必须在仓库根目录执行:  cd /path/to/ragflow && bash scripts/tbox-deps-step-by-step.sh <命令>
#
# 命令:
#   help              显示本说明
#   1 或 download     仅 download_deps.py（大文件下载集中在此步）
#   2 或 deps         仅 docker build Dockerfile.deps（需步骤 1 已在仓库根生成文件）
#   3 或 ragflow       仅 docker compose build ragflow-cpu（需步骤 2；DEVICE 见 docker/.env）
#   all               依次执行 1 → 2（不执行 3；步骤 3 建议单独跑以便观察主镜像构建）
#
# 常用环境变量（与 pull-local-deps-for-docker.sh / download_deps.py 一致）:
#   TBOX_CHINA_DOWNLOAD=1   国内镜像
#   NO_CHROME_DOWNLOAD=1    跳过 Chrome 大包，写占位 zip（镜像内浏览器自动化不可用）
#   SKIP_NLTK_DOWNLOAD=1    跳过 NLTK（不推荐）
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

CMD="${1:-help}"
[[ $# -ge 1 ]] && shift
DEVICE="${DEVICE:-cpu}"

case "$CMD" in
  help|-h|--help|"")
    cat <<'EOF'
必须在仓库根目录执行（含 scripts/ 与 download_deps.py）。

  cd ~/ragflow

步骤 1 — 只下载文件（可随时 Ctrl+C 中断，之后重跑同一条命令续传已存在文件）:

  TBOX_CHINA_DOWNLOAD=1 NO_CHROME_DOWNLOAD=1 bash scripts/tbox-deps-step-by-step.sh 1

若无法下载 text_concat_xgb 模型，可加: RAGFLOW_DISABLE_TEXT_CONCAT_XGB=1（与 docker/.env 中运行时变量一致）。

步骤 2 — 只构建依赖镜像 infiniflow/ragflow_deps:latest:

  bash scripts/tbox-deps-step-by-step.sh 2

步骤 3 — 只构建主 API 镜像（默认 cpu；与 docker/.env 中 DEVICE 一致）:

  bash scripts/tbox-deps-step-by-step.sh 3

若步骤 3 在 FROM ubuntu:24.04 拉取 Hub 超时，任选其一后再执行步骤 3:
  - 在 docker/.env 写入:  RAGFLOW_BASE_IMAGE=docker.m.daocloud.io/library/ubuntu:24.04
  - 或:  TBOX_CHINA_DOWNLOAD=1 bash scripts/tbox-deps-step-by-step.sh 3

一键（依赖下载 + deps 镜像，不含主镜像）:

  TBOX_CHINA_DOWNLOAD=1 NO_CHROME_DOWNLOAD=1 bash scripts/tbox-deps-step-by-step.sh all

主镜像构建完成后，启动栈:

  cd docker && bash tbox-compose-up.sh

若未在 ~/ragflow，先:  cd /你的/ragflow克隆路径
EOF
    ;;
  1|download)
    echo "==== 步骤 1/3: download_deps.py（仅下载，不 docker build）===="
    ARGS=(--download-only)
    [[ "${TBOX_CHINA_DOWNLOAD:-0}" == "1" ]] && ARGS+=(--china-mirrors)
    [[ "${NO_CHROME_DOWNLOAD:-0}" == "1" || "${SKIP_CHROME_DEPS:-0}" == "1" ]] && ARGS+=(--skip-chrome)
    [[ "${SKIP_NLTK_DOWNLOAD:-0}" == "1" ]] && ARGS+=(--skip-nltk)
    [[ "${SKIP_HUGGINGFACE_DOWNLOAD:-0}" == "1" ]] && ARGS+=(--skip-huggingface)
    [[ "${RAGFLOW_DISABLE_TEXT_CONCAT_XGB:-0}" == "1" || "${SKIP_TEXT_CONCAT_XGB_DOWNLOAD:-0}" == "1" ]] && ARGS+=(--disable-text-concat-xgb)
    bash scripts/pull-local-deps-for-docker.sh "${ARGS[@]}"
    echo "==== 下一步: bash scripts/tbox-deps-step-by-step.sh 2 ===="
    ;;
  2|deps)
    echo "==== 步骤 2/3: Dockerfile.deps → infiniflow/ragflow_deps:latest ===="
    bash scripts/pull-local-deps-for-docker.sh --docker-deps-only
    echo "==== 下一步: bash scripts/tbox-deps-step-by-step.sh 3 ===="
    ;;
  3|ragflow)
    echo "==== 步骤 3/3: 主 RAGFlow 镜像（含 TBOX），DEVICE=${DEVICE} ===="
    cd docker
    # shellcheck disable=SC1091
    set -a && [[ -f .env ]] && source ./.env && set +a
    if [[ "${TBOX_CHINA_DOWNLOAD:-0}" == "1" && -z "${RAGFLOW_BASE_IMAGE:-}" ]]; then
      export RAGFLOW_BASE_IMAGE="docker.m.daocloud.io/library/ubuntu:24.04"
      echo "==> TBOX_CHINA_DOWNLOAD=1: using RAGFLOW_BASE_IMAGE=${RAGFLOW_BASE_IMAGE}"
    fi
    DEVICE="${DEVICE:-cpu}"
    RAGFLOW_IMAGE="${RAGFLOW_IMAGE:-ragflow-tbox:local}"
    export RAGFLOW_IMAGE
    docker compose -f docker-compose.yml --profile "${DEVICE}" build "ragflow-${DEVICE}"
    echo "==== 镜像已构建。启动: cd docker && bash tbox-compose-up.sh（若 TBOX_BUILD_RAGFLOW=0 可跳过再 build）===="
    ;;
  all)
    echo "==== 步骤 1+2（不构建主 ragflow 镜像）；请按需设置 TBOX_CHINA_DOWNLOAD / NO_CHROME_DOWNLOAD 等 ===="
    bash "$0" 1
    bash "$0" 2
    echo "==== 已完成 1+2。主镜像请执行: bash scripts/tbox-deps-step-by-step.sh 3 ===="
    ;;
  *)
    echo "未知命令: $CMD ；运行: bash scripts/tbox-deps-step-by-step.sh help" >&2
    exit 1
    ;;
esac
