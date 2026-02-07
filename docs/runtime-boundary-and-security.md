# Runtime 邊界與安全模型

## 📅 建立日期

2026-02-07

## 1) 設計目標

- 讓 Agent「看得到必要狀態」，但「碰不到高風險原始碼/部署面」。
- 降低誤寫、誤刪、誤操作對主系統的影響範圍。
- 讓開發與部署都能維持可預測的一致性。

## 2) 資料與目錄分層

### A. Control Plane（orchestrator）

- 主要責任：Telegram、命令處理、排程、資料庫存取、操作審計。
- 建議掛載：
  - 可寫：`/app/data`
  - 唯讀：設定檔、skills、文件快照模板

### B. Execution Plane（agent-runner）

- 主要責任：執行 Gemini/Opencode CLI 與工具呼叫。
- 建議掛載：
  - 可寫：`/app/workspace`
  - 唯讀：`/app/workspace/context`
  - 不掛載：`/app/src`（避免直接寫入或路徑越界）

### C. Context Plane（context snapshot）

- 路徑：`workspace/context/`
- 更新頻率：啟動/重載事件即時更新 + 週期性刷新（預設 60 秒，可用 `CONTEXT_REFRESH_MS` 調整，最小 10 秒）。
- 內容範例：
  - `runtime-status.md`：服務狀態、版本、provider、模型、時間區。
  - `provider-status.md`：目前 provider/model/timezone 設定快照。
  - `scheduler-status.md`：排程清單與最後載入時間。
  - `error-summary.md`：最近 runtime 錯誤摘要（除錯用途）。
  - `runner-status.md`：runner 成功率、平均耗時、最後請求摘要。
  - `runner-audit.log`：runner request JSONL 稽核軌跡。
  - `system-architecture.md`：高層架構與資料流說明。
  - `operations-policy.md`：允許/禁止操作、執行規範。

## 3) 權限策略（建議）

- Agent 預設不可寫 `src`、不可直接變更部署檔。
- `workspace` 為唯一可寫區，所有臨時輸出在此生成。
- `skills` 掛載建議唯讀，避免 runtime 被 AI 改寫技能定義。
- 對高風險操作加入白名單（例如僅允許讀取特定 runtime 狀態檔）。

## 4) 目前已知衝突與修正方向

- 問題：`workspace/src -> /app/src` 的 symlink 在沙箱檢查中常被 realpath 判定為越界。
- 影響：Agent 嘗試讀取原始碼或 build 輸出時回報 path not in workspace。
- 修正：移除此依賴，改由 orchestrator 生成 `workspace/context/*.md` 提供可觀測資料。

## 5) 安全基準檢查清單

- [ ] Agent 無法直接寫入 `src`。
- [ ] Agent 僅可在 `workspace` 內產生或修改檔案。
- [ ] 所有排程變更有事件記錄（誰、何時、做了什麼）。
- [ ] 可清楚區分 `exec` 與 `run` 的操作語意，避免誤操作。
- [ ] 生產與開發環境的關鍵 volume 權限一致。

## 6) 事件稽核建議

- 記錄項目：`timestamp`, `actor`, `command`, `result`, `target`。
- 最低要求：排程新增/刪除、重載、觸發失敗、CLI timeout、provider 切換。
- 追蹤目的：快速定位「資料已變更但主程序未載入」類事件。

## 7) 實務原則

- 可觀測性不等於開放原始碼寫權。
- 先讓 Agent 看摘要與狀態，再按需增補可讀資訊。
- 用流程與邊界保護系統，而不是依賴模型自律。
