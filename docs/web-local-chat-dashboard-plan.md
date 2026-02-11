# Web Local Chat + Dashboard 實作計畫

## 📅 建立日期

2026-02-11

## 1) 目標與範圍

- 在保留現有 Telegram 通道的前提下，新增本地瀏覽器互動入口（localhost Web Chat）。
- 提供可視化 Dashboard，集中查看記憶、排程與系統狀態。
- Web 與 Telegram 採用共用使用者識別（`WEB_USER_ID` 預設回退 `ALLOWED_USER_ID`），共用同一份記憶與排程資料。
- 本輪以低風險落地為優先，不一次導入重型前端框架或複雜認證系統。

## 2) 現況摘要（As-Is）

- 主流程集中於 `src/main.ts`，目前僅綁定 `TelegramConnector`。
- 訊息處理含：命令路由、摘要策略、記憶寫入、Agent 呼叫、錯誤處理。
- 記憶與排程資料存於 SQLite（`src/core/memory.ts`）。
- 系統觀測快照已定期輸出至 `workspace/context/*.md`。
- `Connector` 已抽象化，但實作目前僅 Telegram。

## 3) 目標架構（To-Be）

- `TelegramConnector`：維持現有收發流程。
- `WebConnector`（新增）：提供本地 Web 收發能力。
- `Message Pipeline`（新增/抽離）：統一處理所有入口的訊息流程。
- `Web Server`（新增）：
  - 靜態頁面：聊天 + Dashboard
  - API：聊天、記憶、排程、狀態查詢

## 4) 分階段執行（Implementation Plan）

### Phase 1：抽離共用訊息管線

目的：避免 Telegram/Web 各自維護一份流程，降低行為漂移風險。

工作項目：

- 從 `src/main.ts` 抽離共用 `handleIncomingMessage`（或等價模組）。
- 將命令處理、摘要、記憶、AI 對話、錯誤處理整合為可重用流程。
- Telegram 入口改用共用管線，功能與輸出保持不變。

驗收條件：

- Telegram 的 `/start`、`/add_schedule`、一般對話行為與既有版本一致。

### Phase 2：新增本地 Web API

目的：提供不依賴外部 IM 的本地入口。

工作項目：

- 新增本地 HTTP 服務（僅綁定 `127.0.0.1`）。
- 建立 API（最小可用）：
  - `POST /api/chat`
  - `GET /api/memory/recent`
  - `GET /api/memory/search`
  - `GET /api/schedules`
  - `GET /api/status`
- 新增環境變數：`WEB_ENABLED`、`WEB_BIND`、`WEB_PORT`、`WEB_AUTH_TOKEN`、`WEB_USER_ID`。

驗收條件：

- 本機瀏覽器可成功送出訊息並取得 AI 回覆。
- API 可讀取記憶、排程與狀態資料。

### Phase 3：新增 Web UI（Chat + Dashboard）

目的：提升本地可用性與觀測效率。

工作項目：

- 新增靜態頁面（HTML/CSS/JS）：
  - 左側：聊天區
  - 右側：Dashboard（記憶、排程、狀態）
- 顯示 thinking 狀態（前端視覺層，不依賴訊息 edit API）。
- 行動裝置與桌面版皆可正常使用。

驗收條件：

- 可直接在瀏覽器互動，並即時查看關鍵狀態。

### Phase 4：文件與運維收斂

目的：確保可維護、可回滾、可交接。

工作項目：

- 更新 README：啟用方式、環境變數、常見問題。
- 補充 runbook：本地 Web 故障排查、埠衝突、token 錯誤。
- 於 migration log 持續記錄每個子階段完成項目與驗證結果。

驗收條件：

- 新成員可依文件完成啟動與基本驗證。

## 5) API 草案（MVP）

- `POST /api/chat`
  - request: `{ message: string }`
  - response: `{ reply: string, messageId?: string, mode: "local" | "runner" }`
- `GET /api/memory/recent?limit=20`
  - response: 最近對話列表（依時間排序）
- `GET /api/memory/search?q=...&limit=20`
  - response: FTS 檢索結果
- `GET /api/schedules`
  - response: 使用者排程列表
- `GET /api/status`
  - response: runtime/provider/scheduler/runner 摘要

已擴充（2026-02-11）：

- `POST /api/chat/stream`（SSE）
- `GET /api/memory/stats`
- `GET /api/memory/history`
- `GET /api/memory/export`
- `POST /api/schedules`
- `PUT /api/schedules/:id`
- `DELETE /api/schedules/:id`
- `POST /api/schedules/toggle`
- `POST /api/schedules/reload`
- `POST /api/reflect`

## 6) 安全策略

- 監聽位址預設 `127.0.0.1`，不對外網開放。
- 可選 `WEB_AUTH_TOKEN`，API 要求 `Authorization: Bearer <token>`。
- 若未啟用 token，明確標示為開發模式。
- 不在前端顯示敏感環境變數。

## 7) 風險與對策

- 風險：Telegram/Web 流程分叉，導致行為不一致。
  - 對策：先完成 Phase 1 抽管線，再接 Web。
- 風險：Web 請求量增加影響主流程回應。
  - 對策：沿用既有 runner canary 與 fallback 策略。
- 風險：本地埠衝突造成服務啟動失敗。
  - 對策：`WEB_PORT` 可配置，啟動時輸出清晰錯誤訊息。

## 8) 回滾策略

- 可透過 `WEB_ENABLED=false` 快速關閉 Web 功能。
- 若抽管線後發現行為差異，可暫時回到 Telegram 直連流程。
- 保持資料層（SQLite schema）不變，避免回滾涉及遷移。

## 9) Decision Record

- DR-001：採「Telegram + 本地 Web」雙入口並行，不替換既有 Telegram 入口。
- DR-002：Web 採共用使用者識別（`WEB_USER_ID` 預設回退 `ALLOWED_USER_ID`）。
- DR-003：先同步 API + 靜態頁 MVP，再評估 streaming 與登入系統。

## 10) 進度更新（2026-02-11）

- Phase 1：完成（共用 message pipeline 已落地）
- Phase 2：完成（Web API 已支援 chat/memory/schedules/status + 擴充操作端點）
- Phase 3：完成（Chat + Dashboard + SSE + 排程操作 + 告警條）
- Phase 4：進行中（README 已更新；runbook/長期維運文件待補）

測試現況：

- 已新增 `tests/memory-manager.test.ts`（記憶分頁）
- 已新增 `tests/scheduler-validation.test.ts`（cron 驗證與排程更新）

前端重構現況（2026-02-11）：

- 已採 plain vanilla 多 view 結構（`#/chat`, `#/memory`, `#/schedules`, `#/status`）
- 已將前端資源拆分至 `src/web/public/app/*`（router/state/api/views）
- `server.ts` 已改為優先提供靜態檔與注入 `__APP_CONFIG__`，保留舊 inline HTML 作 fallback

前端優化現況（2026-02-11）：

- 已補上 services 層（`src/web/public/app/services/*`），將 API 呼叫從 view 中抽離
- 已補上 view lifecycle helper（`utils/view.js`），統一事件註冊/清理，降低洩漏風險
- 已改為 keep-alive route 切換（保留各頁 DOM 狀態），減少切頁閃爍與輸入丟失
- 已完成整體視覺升級（Data-Dense dashboard 方向，含狀態膠囊/焦點狀態/動效降噪）
