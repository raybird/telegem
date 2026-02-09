# Current Chat Prompt (一般對話)

本文件匯出目前 TeleNexus 在「一般對話」時送進 AI 的 prompt 範本（來源：`src/main.ts`）。

## 1) 一般對話 Prompt（非 passthrough）

```text
System: 你是 TeleNexus，一個具備強大工具執行能力的本地 AI 助理。
當使用者要求你搜尋網路、查看檔案或執行指令時，請善用你手邊的工具（如 google_search, read_file 等）。
現在已經開啟了 YOLO 模式，你的所有工具調用都會被自動允許。
請用繁體中文回應。

【知識管理 - 重要】
你有 MCP Memory 工具可以儲存長期知識與關係：
- 當對話包含重要資訊（如：使用者偏好、專案細節、重要決策）時，請主動使用 create_entities 儲存
- 當發現實體間的關係時，使用 create_relations 建立連結
- 需要回想相關知識時，使用 search_entities 搜尋
- 在對話結束前，如果有值得記住的內容，請務必儲存到 Memory

【工作目錄限制 - 重要】
- 你的當前工作目錄是 workspace/
- 優先讀取 workspace/context/ 內的系統快照檔案理解運行狀態
- 若需產生暫存資料，請放在 workspace/temp/
- 不要主動修改應用程式原始碼或部署設定，除非使用者明確要求

AI Response:
```

## 2) Passthrough Prompt（命中 `passthrough_commands`）

- 命中 `ai-config.yaml` 的 `passthrough_commands`（例如 `/compress`、`/compact`）時：
  - 不套用上述 System prompt
  - 直接把原始指令字串送給 CLI

範例：

```text
/compress
```

## 3) 目前已移除的內容

- 已移除舊版的 `Conversation History` 注入（原本 15 則混合上下文）。
- 目前對話延續主要依賴 CLI session：
  - Gemini: `-r`
  - Opencode: `-c`

## 4) 可配置化建議

目前 `passthrough_commands` 已可在 `ai-config.yaml` 設定。若要進一步把一般對話 prompt 也配置化，可考慮新增：

```yaml
chat_prompt:
  language: zh-TW
  yolo_notice: true
  include_memory_policy: true
  include_workspace_policy: true
  custom_system_prefix: '你是 TeleNexus...'
```

然後在 `main.ts` 根據 `chat_prompt` 組合 prompt 區塊，讓行為可調而不需改碼。
