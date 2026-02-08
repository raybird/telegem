<p align="center">
  <img src="docs/logo.png" alt="TeleNexus Logo" width="200" />
</p>

# TeleNexus

> 您的私人本地 AI 助理閘道器（Telegram -> Local CLI Agent）

TeleNexus 讓您用 Telegram 控制本機 AI CLI（Gemini / Opencode），並提供排程、記憶、觀測、灰度切流與 Docker 隔離能力。

---

## 你現在拿到的是什麼

- 單人使用優先設計（`ALLOWED_USER_ID` 白名單）
- 支援 `gemini-cli` 與 `opencode`，可由 `ai-config.yaml` 動態切換
- 排程系統（新增/刪除/重載/健康檢查）
- 指令白名單直通（`passthrough_commands` 可在 `ai-config.yaml` 配置）
- `workspace/context/` 觀測快照（避免直接依賴原始碼路徑）
- Phase 3 雙服務架構（`telenexus` + `agent-runner`）
- runner canary 切流（排程與聊天可分開控管）
- runner 安全/穩定機制（shared secret、circuit breaker、審計）

---

## 架構概覽

- `telenexus`（控制平面）
  - Telegram 收訊與回覆
  - command router
  - scheduler
  - 記憶系統
  - 可選：將任務轉送到 `agent-runner`
- `agent-runner`（執行平面，Phase 3 profile）
  - 提供 `GET /health`、`GET /stats`、`POST /run`
  - 執行 Gemini / Opencode
  - 輸出 `runner-audit.log` 與 `runner-status.md`
- `workspace/context/`
  - 系統狀態快照（runtime/provider/scheduler/error/runner）
- `workspace/.gemini/skills`（容器內）
  - 使用獨立 Docker volume，AI 可安裝自訂 skill 而不污染 repo
  - 啟動時會把 `/app/skills` 內建 skills 同步進可寫區

---

## 快速開始（Docker）

### 1) 準備環境變數

請擇一複製後修改：

- 開發/灰度：`.env.example`
- 保守上線：`.env.production.example`

最低必要：

```env
TELEGRAM_TOKEN=your_bot_token
ALLOWED_USER_ID=your_telegram_user_id
DB_DIR=./data
```

### 2) 啟動

一般模式：

```bash
docker compose up -d --build
```

啟用 Phase 3（含 agent-runner）：

```bash
docker compose --profile phase3 up -d --build
```

### 3) 檢查服務

```bash
docker compose ps
docker compose logs -f telenexus
```

---

## Skills（不污染 repo）

- 內建 skills 來源：`/app/skills`（唯讀）
- AI 可寫技能目錄：`/app/workspace/.gemini/skills`（獨立 volume）
- 啟動時會自動同步內建 skills 到可寫目錄（不覆蓋已存在的自訂 skills）

容器內檢查：

```bash
docker compose exec telenexus ls -la /app/workspace/.gemini/skills
```

手動安裝自訂 skill（範例）：

```bash
docker compose exec telenexus npx skill-linker --from https://github.com/your-org/your-skill-repo
```

---

## 推薦設定（單人使用）

以下是建議基線（可直接用在 `.env`）：

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

### `ai-config.yaml` 補充（指令白名單）

可在 `ai-config.yaml` 設定要直通給底層 CLI/Agent 的 slash 指令：

```yaml
passthrough_commands:
  - /compress
  - /compact
  - /clear
```

若未設定，系統預設使用上述三個指令。
命中白名單時，主程式會將原始指令（例如 `/compress`）直接送給底層 AI CLI，不包裝 TeleNexus 的 system prompt。
此外，passthrough 指令流程不會對該次請求額外做 TeleNexus 的摘要/上下文包裝，避免干擾 CLI 原生行為。

---

## 排程操作（重點）

請在 Docker 用 `exec`，不要用 `run`：

```bash
# 查詢
docker compose exec telenexus node /app/dist/tools/scheduler-cli.js list

# 新增
docker compose exec telenexus node /app/dist/tools/scheduler-cli.js add "每小時報告" "0 * * * *" "請提供簡單市場分析"

# 重載
docker compose exec telenexus node /app/dist/tools/scheduler-cli.js reload

# 健康檢查
docker compose exec telenexus node /app/dist/tools/scheduler-cli.js health
```

---

## Runner API（內網）

- `GET /health`：基本健康狀態
- `GET /stats`：執行統計（若設定 `RUNNER_SHARED_SECRET`，需帶 `x-runner-token`）
- `POST /run`：執行任務（同樣需 token）

快速檢查：

```bash
docker compose exec telenexus node -e "fetch('http://agent-runner:8787/health').then(r=>r.json()).then(console.log)"
```

---

## Context 與審計檔

`workspace/context/` 內常用檔案：

- `runtime-status.md`
- `provider-status.md`
- `scheduler-status.md`
- `error-summary.md`
- `runner-status.md`
- `runner-audit.log`

---

## 本機開發命令

```bash
# 主服務開發（watch）
npm run dev

# runner 開發（watch）
npm run dev:runner

# 編譯
npm run build

# 檢查
npm run lint
```

---

## 進一步文件

- 架構：`ARCHITECTURE.md`
- 貢獻：`CONTRIBUTING.md`
- 路線圖：`docs/docker-refactor-roadmap.md`
- 邊界與安全：`docs/runtime-boundary-and-security.md`
- 排程 runbook：`docs/scheduler-operation-runbook.md`
- Phase 3：`docs/phase3-compose-profile.md`
- 上線 checklist：`docs/deployment-cutover-checklist.md`
- 遷移紀錄：`docs/migration-log.md`

---

## 免責聲明

本專案支援高權限 Agent 操作流程。請務必妥善保護：

- `TELEGRAM_TOKEN`
- `RUNNER_SHARED_SECRET`
- `ALLOWED_USER_ID` 白名單設定
