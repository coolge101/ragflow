#!/usr/bin/env bash
# 把 GitHub 下载的 ragflow-main*.zip 解压到仓库 _incoming/，不覆盖当前源码。
# 用法（在仓库根）:  bash scripts/ingest-github-ragflow-zip.sh
# 或指定文件:        bash scripts/ingest-github-ragflow-zip.sh /path/to/ragflow-main.zip
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ZIP="${1:-}"
if [[ -z "$ZIP" ]]; then
  ZIP=$(ls -1t ragflow-main*.zip 2>/dev/null | head -1 || true)
fi
if [[ -z "$ZIP" || ! -f "$ZIP" ]]; then
  echo "用法: bash scripts/ingest-github-ragflow-zip.sh [ragflow-main*.zip]" >&2
  echo "未在仓库根找到 ragflow-main*.zip" >&2
  exit 1
fi

DEST="_incoming/ragflow-main-from-zip"
mkdir -p _incoming
rm -rf "$DEST"
unzip -q -o "$ZIP" -d "$DEST"
ARCH="_incoming/$(basename "$ZIP" .zip).archived.zip"
mv "$ZIP" "$ARCH"
echo "OK: 已解压到 $ROOT/$DEST/"
echo "     源码在: $DEST/ragflow-main/"
echo "     原 zip 已改名为: $ARCH"
echo "说明: GitHub 源码 zip 不含 huggingface.co 模型；见 _incoming/README.txt"
