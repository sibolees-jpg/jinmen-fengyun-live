#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if [[ -x ./runtime/node ]]; then
  app_node=./runtime/node
elif command -v node >/dev/null 2>&1; then
  app_node="$(command -v node)"
else
  echo '请安装 Node.js 24，或把演讲终版的 runtime 文件夹复制到本目录。'
  exit 1
fi
export NODE_USE_ENV_PROXY=1
export NODE_USE_SYSTEM_CA=1
"$app_node" scripts/start-knowledge.mjs
