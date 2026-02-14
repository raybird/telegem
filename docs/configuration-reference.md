# Configuration Reference

## 推薦基線（單人使用）

```env
RUNNER_ENDPOINT=http://agent-runner:8787
SCHEDULE_USE_RUNNER=true

# 聊天流量（可先 10，再逐步提高）
CHAT_USE_RUNNER_PERCENT=100
CHAT_USE_RUNNER_ONLY_USERS=your_telegram_user_id

# runner 安全
RUNNER_SHARED_SECRET=change_this_to_a_long_random_secret

# runner 穩定性
RUNNER_FAILURE_THRESHOLD=3
RUNNER_COOLDOWN_MS=60000

# context 快照刷新
CONTEXT_REFRESH_MS=60000
```

備註：若未設定 `CHAT_USE_RUNNER_ONLY_USERS`，系統會預設使用 `ALLOWED_USER_ID`。

## ai-config.yaml（passthrough_commands）

可在 `ai-config.yaml` 設定要直通給底層 CLI/Agent 的 slash 指令：

```yaml
passthrough_commands:
  - /compress
  - /compact
  - /clear
```

補充：

- 若未設定，系統預設使用上述三個指令
- 命中白名單時，主程式會將原始指令直接送給底層 CLI
- passthrough 流程不會額外套 TeleNexus 摘要/上下文包裝
- Gemini 的 passthrough 請求會略過記憶檢索 hook，避免控制指令被記憶內容干擾

## Runner Session Context（重要）

目前預設聊天流量走 `agent-runner`（`CHAT_USE_RUNNER_PERCENT=100`）。
若要手動除錯並接續同一條 CLI context，請優先進 `agent-runner`。

```bash
# Gemini（接續 session）
docker compose exec agent-runner sh -lc "cd /app/workspace && gemini -r"

# Opencode（接續 session）
docker compose exec agent-runner sh -lc "cd /app/workspace && opencode run -c"
```

補充：

- 一般使用不需要手動進容器
- `/new` 會讓下一則一般對話訊息強制使用新 session
- 在 `telenexus` 容器手動執行 CLI，可能與 runner 實際脈絡不一致
