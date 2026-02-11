# Docker 化重構路線圖（漸進式）

## 📅 建立日期

2026-02-07

## 1) 目標與原則

- 目標：在保留開發速度的前提下，完成 Telegram 控制 AI Agent 的安全隔離與可觀測性。
- 原則：小步快跑、每階段可回滾、先穩定再拆分、先收斂入口再重構架構。
- 開發模式：持續保留「本機快速開發」與「Docker 整合驗證」雙路徑。

## 2) 現況摘要（As-Is）

- 單一 `telenexus` service 同時承擔：Telegram connector、命令路由、排程、資料存取、CLI 呼叫。
- Agent 以 `workspace/` 執行（`gemini --yolo --resume -p`），但同時希望可讀 `src` 以理解系統狀態。
- 透過 symlink/mount 暴露 `src` 給 Agent 時，容易與工具沙箱邊界衝突（realpath 越界判定）。
- 排程存在兩種控制路徑：
  - 路徑 A：Telegram `/add_schedule`（in-process）
  - 路徑 B：`scheduler-cli`（DB + SIGUSR1 reload）
- Docker 環境中若以 `docker compose run` 觸發路徑 B，常造成通知主程序失敗與行為不一致。

## 3) 目標架構（To-Be）

- `orchestrator`（主服務）：
  - Telegram 入口、Command Router、Scheduler、Memory/DB。
  - 唯一控制面，排程寫入與載入都由此服務負責。
- `agent-runner`（執行服務）：
  - 專責執行 Gemini/Opencode CLI。
  - 僅掛載必要目錄，預設不具 `src` 寫入能力。
- `workspace/context`（唯讀資訊層）：
  - 由 orchestrator 生成快照（架構摘要、執行狀態、排程狀態）。
  - 取代直接將原始碼層暴露給 Agent。

## 4) 分階段執行（最小風險）

### Phase 1：入口收斂與排程穩定化（優先）

**目的**：解決「排程新增已入 DB 但主程序未載入」問題。

工作項目：

- 統一正式入口為 Telegram 指令（in-process）。
- `scheduler-cli` 保留為維運工具，不再作為主要產品路徑。
- `scheduler-cli` 增加錯誤可見性（顯示通知失敗原因與 PID 探測結果）。
- 文件與操作手冊明確規範：容器內管理排程使用 `docker compose exec`，避免 `run`。

驗收條件：

- 新增排程後，log 必須看到 reload/掛載證據。
- 每小時排程可連續穩定觸發（至少 2 個整點驗證）。

回滾：

- 回復 CLI 日誌強化改動，不影響核心資料與排程 schema。

### Phase 2：邊界重整（可觀測但不可寫 src）

**目的**：避免 Agent 直接接觸原始碼層造成風險與路徑錯誤。

工作項目：

- 移除依賴 `workspace/src -> /app/src` 的可讀路徑設計。
- 新增 `workspace/context/` 生成器（只讀文本快照）。
- 在 prompt 中引導 Agent 優先讀取 `workspace/context/*`。

驗收條件：

- Agent 可正確回答系統狀態問題，不需直接讀 `/app/src`。
- 不再出現與 `src` symlink 有關的路徑越界錯誤。

回滾：

- 保留舊 prompt 與 symlink 配置，必要時可快速退回。

### Phase 3：服務拆分（orchestrator / agent-runner）✅ 已完成並成為標準部署

**目的**：把控制平面與執行平面分離,降低耦合與 blast radius。

**狀態**：✅ 已於 2026-02-11 完成測試並提升為標準部署方式

工作項目：

- ✅ compose 增加 `agent-runner` service
- ✅ orchestrator 透過明確介面 (HTTP API) 呼叫 runner
- ✅ 強化健康檢查、重啟策略、逾時與重試政策
- ✅ 移除 profile 機制,雙服務成為預設部署

驗收條件：

- ✅ Telegram、排程、Agent 呼叫任一子系統異常時,不影響其餘核心流程
- ✅ Docker 與本機雙模式皆可啟動並通過 smoke test
- ✅ 不需要 `--profile phase3`,標準 `docker compose up` 即可啟動雙服務

回滾：

- 若需回退,可在 `docker-compose.yml` 中為 `agent-runner` 重新添加 `profiles: [phase3]`

## 5) 風險矩陣

- 高：排程雙入口導致狀態不一致。
- 中：路徑沙箱與 symlink realpath 衝突。
- 中：單服務中任務阻塞導致回應延遲。
- 低：文件與實際操作不一致造成誤操作。

## 6) 驗證策略

- Smoke Test：`/start`、`/list_schedules`、`/add_schedule`、`/remove_schedule`。
- Scheduler Test：新增整點任務、觀察掛載 log、驗證觸發訊息。
- Failure Test：模擬 CLI timeout/429，確認主流程可恢復。
- Boundary Test：確認 Agent 無法寫入原始碼層。

## 7) 非目標（本輪不做）

- 不引入重型 message queue（如 Kafka）。
- 不改動核心資料 schema（除非必要且可遷移）。
- 不一次性重寫全部 prompt 與 skills。

## 8) Decision Record（持續更新）

- DR-001：維持雙模式開發（本機 dev + Docker 驗證），避免日常迭代速度下降。
- DR-002：先穩定排程再拆服務，避免同時引入過多變數。
- DR-003：以 `workspace/context` 取代直接暴露 `src` 給 Agent。
