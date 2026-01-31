## 架構概覽

Moltbot Lite 由數個可替換的模組組成，核心目標是以 Telegram 作為入口，連接本機的 `gemini-cli`，並透過 SQLite 做記憶管理與排程執行。

### 模組責任
- `src/main.ts`：啟動流程、組裝依賴、訊息主流程。
- `src/core/command-router.ts`：處理內建指令（例如 `/reset`、排程管理）。
- `src/core/gemini.ts`：封裝 gemini-cli 呼叫與輸出清理。
- `src/core/memory.ts`：記憶儲存、摘要、與全文檢索。
- `src/core/scheduler.ts`：排程任務管理與執行。
- `src/connectors/telegram.ts`：Telegram 連接器與訊息格式轉換。

### 主要資料流
1. 使用者透過 Telegram 發送訊息。
2. `TelegramConnector` 將訊息轉成 `UnifiedMessage`，交給 `main.ts`。
3. `CommandRouter` 嘗試處理指令；若無匹配，進入一般聊天流程。
4. 記憶模組保存使用者訊息，並組合近期上下文。
5. `GeminiAgent` 呼叫 `gemini-cli` 取得回應。
6. 回應儲存至記憶，並回傳 Telegram。

### 擴充建議
- 新增指令：在 `CommandRouter` 註冊新的 command。
- 新增連接器：實作 `Connector` 介面並在 `main.ts` 注入。
- 新增記憶策略：在 `MemoryManager` 擴充摘要或索引邏輯。
