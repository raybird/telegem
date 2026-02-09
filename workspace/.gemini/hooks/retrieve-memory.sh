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

# Slash command（例如 /compress）不做記憶注入，避免干擾控制指令語意
if [[ "$user_prompt" == /* ]]; then
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
# 安全：使用環境變數傳遞參數，避免 shell/JS 字串插值風險
export USER_PROMPT="$user_prompt"
export MEMORY_DB_PATH="$DB_PATH"

query_result=$(node <<'NODE'
const Database = require('better-sqlite3');
const dbPath = process.env.MEMORY_DB_PATH;
if (!dbPath) {
  process.exit(0);
}
const db = new Database(dbPath, { readonly: true });

const prompt = process.env.USER_PROMPT || '';

const entities = db.prepare('SELECT name FROM entities').all().map(e => e.name);
const matchedEntities = entities.filter(e => prompt.includes(e));

const chineseWords = prompt.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
const stopwords = new Set([
  '今天', '現在', '剛剛', '等等', '這個', '那個', '如何', '分析', '報告', '資訊',
  '問題', '處理', '請問', '幫我', '可以', '是否', '一下', '內容', '訊息', '狀況'
]);
const filteredWords = chineseWords.filter(w => !stopwords.has(w));

const keywords = [...new Set([...matchedEntities, ...filteredWords])].slice(0, 12);

if (matchedEntities.length === 0 && keywords.length < 2) {
  console.log('');
  process.exit(0);
}

const likeConditions = keywords.map(() => '(o.content LIKE ? OR e.name LIKE ?)').join(' OR ');
const likeParams = keywords.flatMap((k) => {
  const pattern = `%${k}%`;
  return [pattern, pattern];
});

const sql = `
  SELECT DISTINCT
    e.name as entity_name,
    e.entity_type,
    o.content,
    o.created_at
  FROM observations o
  INNER JOIN entities e ON o.entity_name = e.name
  WHERE ${likeConditions}
  ORDER BY o.created_at DESC
  LIMIT 20
`;

try {
  const rawResults = db.prepare(sql).all(...likeParams);
  const scored = rawResults
    .map((r) => {
      const text = `${r.entity_name} ${r.content}`;
      let score = 0;
      for (const k of keywords) {
        if (text.includes(k)) score += 1;
      }
      if (matchedEntities.includes(r.entity_name)) {
        score += 2;
      }
      return { ...r, score };
    })
    .filter((r) => r.score >= 2)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Number(new Date(a.created_at));
      const tb = Number(new Date(b.created_at));
      return tb - ta;
    })
    .slice(0, 5);

  if (scored.length > 0) {
    const formatted = scored
      .map((r, i) => `${i + 1}. [${r.entity_type}] ${r.entity_name}: ${r.content}`)
      .join('\n');
    console.log(formatted);
  }
} catch (err) {
  process.stderr.write('Query error: ' + err.message);
}

db.close();
NODE
)

if [ -n "$query_result" ]; then
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
