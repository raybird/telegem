#!/bin/bash
# Auto-memory hook: 自動分析對話並儲存到 MCP memory

# 讀取 stdin（包含對話內容）
input=$(cat)

# 提取對話內容（簡化版，實際需要更複雜的 JSON 解析）
conversation=$(echo "$input" | jq -r '.conversation // empty')

# 判斷是否有值得儲存的內容（簡單啟發式）
if echo "$conversation" | grep -qiE "(重要|記住|專案|偏好|決策)"; then
  # 返回提醒訊息
  cat <<'EOF'
{
  "decision": "allow",
  "systemMessage": "🧠 偵測到重要資訊，建議使用 MCP Memory 儲存！"
}
EOF
else
  # 一般對話，不做提醒
  echo '{"decision": "allow"}'
fi

exit 0
