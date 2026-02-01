<p align="center">
  <img src="docs/logo.png" alt="TeleNexus Logo" width="200" />
</p>

# 🤖 TeleNexus

> **您的私人本地 AI 助理閘道器**
>
> 這是基於 `telegem` 核心精神實作的本地 AI 助理。它將您的 Telegram 帳號直接連接到本地電腦的 `gemini-cli` 或 `opencode` 大腦，具備完整的工具執行權限與持久化記憶。

---

## ✨ 核心特色

*   **🧠 強大腦力**: 支援 `gemini-cli` 與 `opencode run` 雙提供者。
*   **🔄 動態切換**: 透過 `ai-config.yaml` 實現熱切換 (Hot Swap)，不必重啟服務。
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
- **AI Backend**: 支援 `gemini-cli` 與 `opencode run` (可動態切換)
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
cd telenexus

# 安裝依賴
npm install
```

### 3. 環境變數配置
建立 `.env` 檔案並填入資訊：
```env
TELEGRAM_TOKEN=你的_BOT_TOKEN
ALLOWED_USER_ID=你的_TELEGRAM_ID
```
*(提示：您可以透過 [@userinfobot](https://t.me/userinfobot) 取得您的 Telegram ID)*

### 4. AI 提供者設定 (v2.1+)
v2.1 起支援多提供者，請編輯 `ai-config.yaml`（若不存在請根據 `ai-config.example.yaml` 建立）：
```yaml
# ai-config.yaml
provider: gemini  # 選項：gemini, opencode
model: gemini-2.0-flash-exp  # 可選，指定模型名稱
```
> [!TIP]
> 此設定檔支援**動態重載**，您可以在服務運行時隨時修改 Provider，下次對話將自動生效。

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

## 🐳 Docker 使用方式

### 1. 設定環境變數
建立 `.env`（或使用現有 `.env`），確保包含：
```env
TELEGRAM_TOKEN=你的_BOT_TOKEN
ALLOWED_USER_ID=你的_TELEGRAM_ID
DB_DIR=./data
```

### 2. 啟動容器
```bash
docker compose up -d --build
```

### 3. Gemini CLI 設定
專案使用獨立的 gemini-cli 設定：
- **專案設定**：`./workspace/.gemini/settings.json`（含 MCP servers 設定）
- **認證資訊**：由 Docker volume 管理（`gemini_auth`）

**首次使用 - 登入**：
```bash
docker compose exec telegem gemini
```
登入資訊會保存到 volume，重建容器不會遺失。

**調整 MCP 設定**：
編輯 `./workspace/.gemini/settings.json` 後重啟容器：
```bash
docker compose restart
```

### 4. 常用指令
```bash
# 查看日誌
docker compose logs -f telegem

# 停止容器
docker compose down

# 重啟容器
docker compose restart

# 進入容器 shell
docker compose exec telegem bash
```

### 5. 資料庫位置
- 本機開發：`./data/telegem.db`（透過 `DB_DIR` 設定）
- 容器內：`/data/telegem.db`（透過 volume 掛載 `./data`）
- 資料會保存在主機的 `./data` 目錄，重建容器不會遺失

### 6. 長期記憶與知識管理

**MCP Memory Server**：
- 專案已整合 `mcp-memory-libsql`，提供向量搜尋與知識圖譜功能
- AI 會自動判斷重要資訊並儲存到 `/data/memory.db`
- 支援實體（entities）、關係（relations）與語義搜尋

**自動記憶機制**：
- System prompt 已引導 AI 主動使用 MCP memory
- `BeforeAgent` hook 會在每次對話前自動檢索相關記憶並注入 Prompt
- 透過 `workspace/.gemini/hooks/retrieve-memory.sh` 實現語義搜尋與記憶增強

**手動管理**：
```bash
# 查看已儲存的記憶（需在對話中詢問 AI）
"請列出我的記憶實體"

# 搜尋相關知識
"搜尋關於專案架構的記憶"
```

### 7. 擴充 Skills 與其他 MCP Servers（選用）

**MCP Servers 設定**：
- 編輯 `./workspace/.gemini/settings.json` 中的 `mcpServers` 區塊
- 容器已預裝 `uv`/`uvx`，支援 Python MCP servers

**安裝 Skills**：
```bash
# 進容器安裝
docker compose exec telegem npx skill-linker --from https://github.com/...

# 重啟生效
docker compose restart
```

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
- `/reflect`: 手動觸發追蹤分析（分析過去 24 小時的對話）

### 記憶系統運作方式

TeleGem 採用**智慧混合式記憶架構**：

1. **短期記憶 (最近 5 則)**：直接載入到 AI 的上下文中
   - 短訊息：顯示完整內容
   - 長訊息 (>800 字元)：自動生成並顯示摘要
   
2. **長期記憶 (全文檢索)**：當 AI 需要回想更早的對話時，它會自動執行：
   ```bash
   node dist/tools/search_memory.js "關鍵字"
   ```
   這會從資料庫搜尋相關的歷史對話並提供給 AI 參考。

3. **輸出清洗**：所有 `<thinking>` 內部思考過程會被自動過濾，確保您只看到最終回應。

4. **智慧追蹤系統**：
   - **每日摘要**：系統會在每日 09:00 主動發送前一天的對話摘要與待辦事項彙整。
   - **主動追蹤**：當對話沉默超過 30 分鐘，AI 會自動分析是否有未解決的問題或潛在優化空間並發送提醒。
   - **手動觸發**：可隨時使用 `/reflect` 指令進行手動分析。

---

## 📂 專案結構
```text
src/
├── core/
│   ├── agent.ts       # AIAgent 介面與動態代理人 (DynamicAIAgent)
│   ├── gemini.ts      # Gemini CLI 實作
│   ├── opencode.ts    # Opencode CLI 實作
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

## 📜 變更日誌

### v2.1.0
- **新增**: 整合 `opencode run` 作為替代 AI 提供者。
- **新增**: 動態設定檔 `ai-config.yaml`，支援熱切換 Provider。
- **新增**: 支援在設定檔中指定特定模型。
- **優化**: 採用 stdin (echo pipe) 提升 CLI 執行速度。
- **優化**: 改善日誌顯示，區分 System、DynamicAgent 與 AI 回應內容。
- **改進**: 統一 `AIAgent` 介面，強化排程與追蹤系統的抽象化。

### v2.0.0
- 專案初始化，支援 Gemini CLI、SQLite 混合記憶與排程系統。

---

## ⚖️ 免責聲明
本專案開啟了 `--yolo` 模式，這意味著 AI 助理有權限在不需要額外確認的情況下執行指令與讀取檔案。請務必確保 `.env` 中的 `ALLOWED_USER_ID` 正確且不洩漏您的 `TELEGRAM_TOKEN`。
