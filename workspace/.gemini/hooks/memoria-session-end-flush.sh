#!/bin/bash
# memoria-session-end-flush.sh - SessionEnd hook
# 最後收尾：寫入 flush 訊號，提醒背景同步器優先處理 queue

set -euo pipefail

project_dir="${GEMINI_PROJECT_DIR:-$(pwd)}"
signal_file="${MEMORIA_HOOK_FLUSH_SIGNAL:-$project_dir/data/memoria-hook-flush.signal}"
mkdir -p "$(dirname "$signal_file")"

date -u +"%Y-%m-%dT%H:%M:%SZ" >"$signal_file"

echo '{"systemMessage":"","suppressOutput":true}'
exit 0
