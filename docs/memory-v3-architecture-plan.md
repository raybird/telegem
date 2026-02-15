# TeleNexus Memory V3 架構規劃

> 目標：把目前「可用」的記憶能力，升級成「可長期維運、可觀測、可回滾」的正式架構。

---

## 1) 背景與目標

目前記憶鏈路已具備：

- TeleNexus 分派前統一記憶檢索（provider-agnostic）
- 對話後 Memoria 背景同步（pipeline enqueue + non-blocking sync）
- MCP 記憶（`data/memory.db`）與 TeleNexus 會話資料（`data/moltbot.db`）

本版（Memory V3）要解決的核心問題：

- 多資料源之間的一致性與可追蹤性
- 主動提醒的準確率（避免噪音提醒）
- 記憶系統健康度可視化與告警
- 長期資料治理（TTL、隱私、forget）

非目標（本版不做）：

- 一次性合併成單一資料庫
- 大幅改寫現有聊天主流程

---

## 2) 現況盤點（As-Is）

- `data/moltbot.db`：對話訊息與排程資料（交易層）
- `data/memory.db`：MCP semantic graph（檢索層）
- `workspace/Memoria/.memory/sessions.db`：長期事件歸檔（歷史層）

目前優點：

- 回覆延遲可控（同步為非阻塞）
- 核心流程可用，故障不會直接中斷對話

目前缺口：

- scheduler 產出未完全納入同一記憶閉環
- Memoria 與 MCP 仍屬最終一致，缺正式對帳機制
- 缺少統一健康儀表（success rate / backlog / lag）

---

## 3) V3 設計原則

- **低延遲優先**：主對話不被同步阻塞
- **最終一致**：允許短暫延遲，但必須可追補
- **可觀測**：每一段都有可量測指標
- **可回滾**：任一新機制可關閉，不影響主流程
- **資料治理**：TTL、敏感資料邊界、forget 機制

---

## 4) 目標架構（To-Be）

1. 捕捉層
   - Telegram/Web 對話成功後由 TeleNexus pipeline enqueue
   - 不依賴 provider hooks（hook-free）

2. 同步層
   - MemoriaSyncBridge queue drain（背景 worker）
   - dedupe + timeout + retry + non-blocking fail-safe

3. 檢索層
   - 即時回答主要由 MCP (`memory.db`) 提供
   - Memoria 作為長期事件歸檔來源

4. 對帳層（V3 新增）
   - 週期性 Memoria -> MCP 增量回填
   - 雙庫校驗（count/hash/checkpoint）

5. 治理層（V3 新增）
   - 記憶分層策略、TTL 與 forget 政策

---

## 5) 六大優化主題

### A. 記憶分層與 TTL

- 分成：操作短期 / 專案決策 / 使用者偏好
- 每層定義 retention 與清理策略

### B. 可信度模型

- 每筆記憶附 `source`、`confidence`、`last_verified_at`
- 低信度記憶只做提醒，不做強結論

### C. 主動提醒門檻

- precision-first：高關聯 + 高信心才主動提醒
- 引入冷卻時間，避免重複提醒疲勞

### D. 記憶健康儀表

- 指標：queue backlog、oldest pending、sync success rate、retry count
- 提供 `/memory-health` 與 `workspace/context/memory-status.md`

### E. 雙庫對帳與回填

- 固定批次回填 Memoria -> MCP
- 建 checkpoint，支援斷點續跑

### F. 隱私與 forget

- 可標記不可持久化資料
- 提供範圍 forget（by tag / topic / time range）

---

## 6) 里程碑與版本切分

### M1（穩定性）

- `/memory-health` 指令
- `memory-status.md` 快照輸出
- queue backlog 告警閾值

### M2（一致性）

- Memoria -> MCP 增量回填 worker
- 對帳報表（每日）
- 基本去重/衝突處理

### M3（體驗與治理）

- 主動提醒門檻引擎
- 可信度輸出策略
- TTL + forget 操作面

---

## 7) SLO / 驗收標準

- `sync_success_rate >= 99%`（24h）
- `queue_oldest_age_p95 < 60s`
- `turn_to_memoria_lag_p95 < 30s`
- `memory_health_endpoint` 可在 1s 內回應
- 同步失敗不影響主回覆（0 blocking incidents）

---

## 8) 風險與回退策略

- queue 暴增：啟用節流與分批 drain
- 重複同步：內容 hash + session id 去重
- 外部依賴故障：自動降級為 queue only
- 回退開關：
  - `MEMORIA_SYNC_ENABLED=off`
  - `MEMORIA_HOOK_QUEUE_ENABLED=true`（僅在需要相容舊流程時啟用）

---

## 9) 實作檢查清單

- [ ] M1：新增 `/memory-health` 與狀態快照
- [ ] M1：設置 backlog/lag 告警門檻
- [ ] M2：建立 Memoria -> MCP 增量回填 job
- [ ] M2：加入對帳報表與 checkpoint
- [ ] M3：主動提醒門檻策略與 AB 驗證
- [ ] M3：TTL 與 forget 流程文件化與工具化

---

## 10) 相關檔案

- `src/core/memoria-sync.ts`
- `src/core/message-pipeline.ts`
- `src/main.ts`
- `workspace/.gemini/settings.json`
- `docs/configuration-reference.md`
