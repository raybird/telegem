#!/bin/bash
# retrieve-memory.sh - BeforeAgent Hook: 從 MCP Memory 檢索相關記憶並注入 Prompt
# 避免遞迴：直接查詢 SQLite，不呼叫 gemini CLI

# Passthrough 模式可要求略過記憶注入（保留同一個 session/cwd）
if [ "$GEMINI_BYPASS_MEMORY_HOOK" = "1" ]; then
  echo '{"decision": "allow"}'
  exit 0
fi

# 讀取 stdin（包含使用者的 Prompt）
input=$(cat)

# 提取使用者的 prompt (支援多種可能的 JSON 欄位)
user_prompt=$(echo "$input" | jq -r '.prompt // .message // .text // empty' 2>/dev/null)

# 如果沒有 prompt 或解析失敗，直接放行
if [ -z "$user_prompt" ]; then
  echo '{"decision": "allow"}' 2>&1
  exit 0
fi

# 資料庫路徑
DB_PATH="$GEMINI_PROJECT_DIR/data/memory.db"

# 檢查資料庫是否存在
if [ ! -f "$DB_PATH" ]; then
  echo "[retrieve-memory] DB not found at $DB_PATH" >&2
  echo '{"decision": "allow"}' 2>&1
  exit 0
fi

# 使用 Node.js 查詢資料庫（使用專案中已安裝的 better-sqlite3）
# 改進的搜尋策略：提取實體名稱和關鍵詞
# 安全修復：使用環境變數傳遞 USER_PROMPT，避免 Injection
export USER_PROMPT="$user_prompt"

query_result=$(node -e "
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH', { readonly: true });

// 安全：從環境變數讀取 Prompt，而非字串插值
const prompt = process.env.USER_PROMPT || '';

// 改進的關鍵字提取：
// 1. 先提取所有已知的實體名稱
const entities = db.prepare('SELECT name FROM entities').all().map(e => e.name);
const matchedEntities = entities.filter(e => prompt.includes(e));

// 2. 提取中文關鍵詞（2-4字的詞組）
const chineseWords = prompt.match(/[\u4e00-\u9fa5]{2,4}/g) || [];

// 3. 合併關鍵字
const keywords = [...new Set([...matchedEntities, ...chineseWords])].slice(0, 10);

if (keywords.length === 0) {
  console.log('');
  process.exit(0);
}

// 構建 LIKE 查詢
const likeConditions = keywords.map(() => 'o.content LIKE ?').join(' OR ');
const likeParams = keywords.map(k => \`%\${k}%\`);

const sql = \`
  SELECT DISTINCT 
    e.name as entity_name,
    e.entity_type,
    o.content,
    o.created_at
  FROM observations o
  INNER JOIN entities e ON o.entity_name = e.name
  WHERE \${likeConditions}
  ORDER BY o.created_at DESC
  LIMIT 5
\`;

try {
  const results = db.prepare(sql).all(...likeParams);
  if (results.length > 0) {
    const formatted = results.map((r, i) => 
      \`\${i+1}. [\${r.entity_type}] \${r.entity_name}: \${r.content}\`
    ).join('\n');
    console.log(formatted);
  }
} catch (err) {
  process.stderr.write('Query error: ' + err.message);
}

db.close();
" 2>&2)

# 如果有找到記憶，注入到 systemMessage
if [ -n "$query_result" ]; then
  # 使用 jq 構建 JSON（避免字串跳脫問題）
  jq -n \
    --arg memories "$query_result" \
    '{
      "decision": "allow",
      "systemMessage": ("【相關記憶】根據對話內容，以下是可能相關的過往資訊：\n" + $memories + "\n\n請參考這些資訊來回答。")
    }' 2>&1
else
  echo '{"decision": "allow"}' 2>&1
fi

exit 0
