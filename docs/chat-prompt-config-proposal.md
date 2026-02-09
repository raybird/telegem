# Chat Prompt 設定外部化提案（ai-config.yaml）

## 目標

- 將 `src/main.ts` 內硬編碼的 prompt 組裝規則搬到 `ai-config.yaml`。
- 讓你可以調整語氣、區塊、限制提示，而不需要改碼重建容器。
- 保持現有行為可回溯：未設定時要有安全預設值。

## 現況（as-is）

- 一般對話 prompt 目前由 `main.ts` 直接組字串。
- `passthrough_commands` 已可在 `ai-config.yaml` 控制（例如 `/compress`）。
- 歷史 15 則注入已移除；上下文延續主要靠 CLI session（Gemini `-r` / Opencode `-c`）。

## 建議設定結構（to-be）

```yaml
provider: gemini
model: gemini-2.0-flash-exp
timezone: Asia/Taipei

passthrough_commands:
  - /compress
  - /compact
  - /clear

chat_prompt:
  language: zh-TW
  role_system: |
    你是 TeleNexus，一個具備強大工具執行能力的本地 AI 助理。
    當使用者要求你搜尋網路、查看檔案或執行指令時，請善用你手邊的工具。
  yolo_notice_enabled: true
  memory_policy_enabled: true
  workspace_policy_enabled: true
  include_ai_response_suffix: true

  memory_policy_lines:
    - 當對話包含重要資訊時，主動使用 create_entities 儲存
    - 當發現實體間關係時，使用 create_relations
    - 需要回想時，使用 search_entities

  workspace_policy_lines:
    - 你的當前工作目錄是 workspace/
    - 優先讀取 workspace/context/
    - 暫存請放 workspace/temp/
    - 未經要求不要修改原始碼或部署設定
```

## 欄位對照（建議）

- `chat_prompt.language`: 目前固定「請用繁體中文回應」。
- `chat_prompt.role_system`: 目前 System 基本角色說明。
- `chat_prompt.yolo_notice_enabled`: 是否插入 YOLO 說明段。
- `chat_prompt.memory_policy_*`: 知識管理段落與條列。
- `chat_prompt.workspace_policy_*`: 工作目錄限制段落與條列。
- `chat_prompt.include_ai_response_suffix`: 是否附 `AI Response:`。

## 預設值策略（重要）

- 若 `chat_prompt` 缺失：使用目前硬編碼內容作為 fallback。
- 若 `chat_prompt` 部分缺欄：只覆蓋有提供欄位，其餘沿用預設。
- `passthrough_commands` 行為不變，仍優先判斷並直通。

## 驗證規則（建議）

- `language`: 允許字串，空值回退預設。
- `*_enabled`: 只能布林。
- `*_lines`: 必須是字串陣列，空陣列視為停用該段。
- 單行長度上限（例如 500 chars）避免配置錯誤造成超長 prompt。

## 實作步驟（建議）

1. 在 `main.ts` 新增 `loadPromptConfig()` + `buildChatPrompt()`。
2. 將目前 prompt 模板抽成 `defaultPromptConfig` 常數。
3. 以「設定覆蓋預設」合成最終 prompt。
4. 更新 `ai-config.example.yaml` 文件化新欄位。
5. 補測試：
   - 無 `chat_prompt`（回退）
   - 部分欄位覆蓋
   - 全部欄位覆蓋
   - 錯誤型別回退

## 風險與控管

- 風險：設定錯誤導致 prompt 缺段或語氣漂移。
- 控管：
  - 解析失敗一律回退預設
  - 啟動時 log 輸出「載入了哪些 prompt 區塊」
  - 保留 `docs/current-chat-prompt.md` 做人工比對基線

## 上線策略

- Phase A：先支援讀設定，但 `ai-config.yaml` 不填 `chat_prompt`（行為不變）。
- Phase B：只覆蓋 `language` / `workspace_policy_lines` 等低風險欄位。
- Phase C：再開放完整 `role_system` 自訂。
