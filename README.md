# 🤖 Moltbot Lite

> **您的私人本地 AI 助理閘道器**
>
> 這是基於 `moltbot` 核心精神實作的精簡版 AI 助理。它將您的 Telegram 帳號直接連接到本地電腦的 `gemini-cli` 大腦，具備完整的工具執行權限與持久化記憶。

---

## ✨ 核心特色

*   **🧠 強大腦力**: 直接串接系統 `gemini-cli`，支援最新的 Gemini 模型。
*   **🛠️ YOLO 模式**: 開啟 Agent 行動能力，可直接進行 **網路搜尋**、**讀取本地檔案** 與 **執行系統指令**。
*   **💾 智慧記憶系統**: 
    *   **混合式上下文**: 自動摘要長訊息，保持 Prompt 輕量（最近 5 則對話）
    *   **全文檢索 (FTS5)**: 可用關鍵字快速搜尋所有歷史對話
    *   **主動式記憶**: AI 可主動呼叫工具回想早期對話內容
    *   **輸出清洗**: 自動過濾 `<thinking>` 區塊，提供乾淨的回應
*   **🔒 安全至上**: 嚴格的 Telegram User ID 白名單機制，確保只有您能控制您的電腦。
*   **⚡ 流暢體驗**: 支援非同步訊息處理，提供「🤔 Thinking...」狀態回傳並在完成後自動更新。
*   **🚀 極簡架構**: 採用 TypeScript + ESM + SQLite，輕量、快速、易於擴充。

---

## 🛠️ 技術棧

- **Runtime**: Node.js 22+ (TypeScript)
- **Framework**: Telegraf (Telegram Bot API)
- **AI Backend**: `gemini-cli` (System Call)
- **Database**: Better-SQLite3
- **Execution**: tsx / esbuild

---

## 📦 安裝與設定

### 1. 前置需求
- 確保系統已安裝 [Gemini CLI](https://github.com/google/gemini-cli) 並已完成登入。
- 擁有一個 Telegram Bot Token (透過 [@BotFather](https://t.me/BotFather) 申請)。

### 2. 下載與安裝
```bash
# 進入專案目錄
cd moltbot-lite

# 安裝依賴
pnpm install
# 或使用 npm install
```

### 3. 環境變數配置
建立 `.env` 檔案並填入資訊：
```env
TELEGRAM_TOKEN=你的_BOT_TOKEN
ALLOWED_USER_ID=你的_TELEGRAM_ID
```
*(提示：您可以透過 [@userinfobot](https://t.me/userinfobot) 取得您的 Telegram ID)*

---

## 🚀 啟動指令

### 開發模式 (自動重啟)
```bash
npm run dev
```

### 生產模式 (編譯並執行)
```bash
npm run build
npm start
```

---

## 🧑‍💻 開發者指引

常用指令：

```bash
# 開發模式（自動重啟）
npm run dev

# 型別檢查
npm run build

# 程式碼品質檢查
npm run lint

# 格式化
npm run format
```

延伸文件：
- 架構說明：[ARCHITECTURE.md](ARCHITECTURE.md)
- 貢獻指南：[CONTRIBUTING.md](CONTRIBUTING.md)

---

## 💡 使用說明

直接在 Telegram 視窗中與您的 Bot 對話即可。

### 常用情境：
- **一般對話**: 「你好，請自我介紹。」
- **網路搜尋**: 「幫我搜尋今天最熱門的 AI 技術新聞。」
- **檔案查詢**: 「讀取當前目錄下的 package.json，看看有哪些依賴？」
- **系統感知**: 「現在幾點？我的電腦路徑在哪裡？」

### 內建指令：

**記憶管理**
- `/reset`: 清除目前在 SQLite 中的所有對話記憶，重新開始新的對話。

**排程管理**
- `/list_schedules`: 列出所有排程任務
- `/add_schedule <名稱>|<cron>|<prompt>`: 新增定時任務
  - 範例：`/add_schedule 早安問候|0 9 * * *|早安！今天天氣如何？`
- `/remove_schedule <id>`: 刪除指定的排程任務

### 記憶系統運作方式

Moltbot 採用**智慧混合式記憶架構**：

1. **短期記憶 (最近 5 則)**：直接載入到 AI 的上下文中
   - 短訊息：顯示完整內容
   - 長訊息 (>800 字元)：自動生成並顯示摘要
   
2. **長期記憶 (全文檢索)**：當 AI 需要回想更早的對話時，它會自動執行：
   ```bash
   node dist/tools/search_memory.js "關鍵字"
   ```
   這會從資料庫搜尋相關的歷史對話並提供給 AI 參考。

3. **輸出清洗**：所有 `<thinking>` 內部思考過程會被自動過濾，確保您只看到最終回應。

---

## 📂 專案結構
```text
src/
├── core/
│   ├── gemini.ts      # 封裝 CLI 調用邏輯 (YOLO 模式 + 摘要 + 清洗)
│   ├── memory.ts      # SQLite 記憶管理 (FTS5 全文檢索)
│   └── scheduler.ts   # Cron 排程管理
├── connectors/
│   └── telegram.ts    # Telegram 介面實作
├── tools/
│   └── search_memory.ts  # 記憶搜尋工具 (供 AI 主動呼叫)
├── types/             # 共用型別定義
└── main.ts            # 程式入口點
```

---

## ⚖️ 免責聲明
本專案開啟了 `--yolo` 模式，這意味著 AI 助理有權限在不需要額外確認的情況下執行指令與讀取檔案。請務必確保 `.env` 中的 `ALLOWED_USER_ID` 正確且不洩漏您的 `TELEGRAM_TOKEN`。
