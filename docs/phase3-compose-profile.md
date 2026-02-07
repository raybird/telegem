# Phase 3 Compose Profile（草稿）

## 目的

- 先建立可啟動的雙服務骨架，不改動現有產品主路徑。
- 保留 `telenexus` 單服務可運作，同時提供 `agent-runner` 隔離平面的預備環境。

## 目前狀態

- `docker-compose.yml` 新增 `agent-runner` 服務，掛在 `phase3` profile。
- `agent-runner` 目前提供最小 API：
  - `GET /health`
  - `GET /stats`（若設定 `RUNNER_SHARED_SECRET`，需帶 `x-runner-token`）
  - `POST /run`（`task: chat|summarize`, `input`, `provider?`, `model?`）
  - 若設定 `RUNNER_SHARED_SECRET`，`POST /run` 需帶 `x-runner-token`
- runner 會輸出 JSONL 審計檔：`workspace/context/runner-audit.log`
  - 欄位包含 `requestId`, `timestamp`, `durationMs`, `task`, `provider`, `ok`, `error?`
- runner 會輸出狀態快照：`workspace/context/runner-status.md`
  - 含全量成功率/平均耗時、近 5 分鐘成功率/平均耗時、最後請求結果
- 預設 `docker compose up -d` 不會啟動 `agent-runner`，避免影響現有流程。
- 啟用方式：

```bash
docker compose --profile phase3 up -d --build
```

## 服務職責（現階段）

- `telenexus`：既有 orchestrator（Telegram、command router、scheduler、agent 呼叫）。
- `agent-runner`：Phase 3 執行平面（承接 AI CLI 執行）。

## 漸進切流（第一步）

- 目前已支援「僅排程任務走 runner」的 canary：
  - `.env` 設定 `RUNNER_ENDPOINT=http://agent-runner:8787`
  - `.env` 設定 `SCHEDULE_USE_RUNNER=true`
  - 可選 `.env` 設定 `CHAT_USE_RUNNER_PERCENT=10`（0-100）
  - 可選 `.env` 設定 `CHAT_USE_RUNNER_ONLY_USERS=915354960`（未設定時預設 `ALLOWED_USER_ID`）
  - 建議 `.env` 設定 `RUNNER_SHARED_SECRET=<strong-secret>`
  - 可選 `.env` 設定 `RUNNER_FAILURE_THRESHOLD=3`、`RUNNER_COOLDOWN_MS=60000`
- 使用者互動訊息可用百分比切流（依 `userId:messageId` 穩定雜湊分桶）；排程（scheduler）可獨立設定優先走 runner。
- runner 不可用時，scheduler 會自動 fallback 回本地執行。
- runner 連續失敗達門檻時會觸發短暫熔斷（cooldown 期間直接走本地，避免雪崩重試）。

## 掛載與邊界（草稿）

- `agent-runner` 掛載：
  - `/app/workspace`（可寫）
  - `/app/data`（目前可寫，後續可再細分）
  - `/app/skills`（唯讀）
  - `ai-config.yaml`（唯讀）
- 認證沿用既有 volume/host bind：
  - `gemini_auth`
  - `${HOME}/.local/share/opencode`

## 下一步（真正切流）

1. 為 runner API 增加鑑權（shared secret）與來源限制。
2. 補 runner timeout/重試與審計紀錄（request id、provider、耗時）。
3. 將使用者互動流量以百分比切到 runner（例如 10% -> 50% -> 100%）。
4. 主服務最終只保留 orchestration，不直接執行 CLI。
