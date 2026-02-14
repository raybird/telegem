#!/bin/bash
# queue-memoria-after-agent.sh - AfterAgent hook
# 輕量落盤：把本輪 user/model 內容寫入共享 queue，供背景同步器處理

set -euo pipefail

input=$(cat)

prompt=$(printf '%s' "$input" | jq -r '.prompt // empty' 2>/dev/null)
response=$(printf '%s' "$input" | jq -r '.prompt_response // empty' 2>/dev/null)
session_id=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)

if [ -z "$prompt" ] || [ -z "$response" ]; then
  echo '{"decision":"allow","suppressOutput":true}'
  exit 0
fi

project_dir="${GEMINI_PROJECT_DIR:-$(pwd)}"
queue_file="${MEMORIA_HOOK_QUEUE_FILE:-$project_dir/data/memoria-hook-queue.jsonl}"
mkdir -p "$(dirname "$queue_file")"

jq -nc \
  --arg userId "gemini:${session_id:-unknown}" \
  --arg userMessage "$prompt" \
  --arg modelMessage "$response" \
  --arg platform "gemini-hook" \
  '{
    userId: $userId,
    userMessage: $userMessage,
    modelMessage: $modelMessage,
    platform: $platform,
    isPassthroughCommand: false,
    forceNewSession: false
  }' >>"$queue_file"

echo '{"decision":"allow","suppressOutput":true}'
exit 0
