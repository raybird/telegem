# Phase 3 上線切換 Checklist

## 0) 前置

- [ ] 已備份 `.env`、`data/moltbot.db`。
- [ ] `.env` 使用 `RUNNER_SHARED_SECRET`，且為長隨機字串。
- [ ] 若要保守上線，確認 `CHAT_USE_RUNNER_PERCENT=0`。
- [ ] 若要灰度聊天，確認 `CHAT_USE_RUNNER_PERCENT`（建議 10 起步）。

## 1) 啟動

- [ ] 啟動指令：

```bash
docker compose --profile phase3 up -d --build
```

- [ ] 服務狀態正常：

```bash
docker compose ps
```

驗收：`agent-runner` 顯示 `healthy`，`telenexus` 為 `Up`。

## 2) 核心健康檢查

- [ ] runner 健康：

```bash
docker compose exec telenexus node -e "fetch('http://agent-runner:8787/health').then(r=>r.json()).then(console.log)"
```

- [ ] runner stats（需 token）：

```bash
docker compose exec telenexus node -e "fetch('http://agent-runner:8787/stats',{headers:{'x-runner-token':process.env.RUNNER_SHARED_SECRET||''}}).then(async r=>{console.log(r.status);console.log(await r.text())})"
```

驗收：`/health` 回 `ok=true`，`/stats` 不帶 token 401、帶 token 200。

## 3) 排程驗證

- [ ] 列出排程：

```bash
docker compose exec telenexus node /app/dist/tools/scheduler-cli.js list
```

- [ ] 觸發重載：

```bash
docker compose exec telenexus node /app/dist/tools/scheduler-cli.js reload
docker compose exec telenexus node /app/dist/tools/scheduler-cli.js health
```

驗收：`Reload confirmed`，且 `health` 的 `Last Reload` 更新。

## 4) 觀測檢查

- [ ] `workspace/context/runtime-status.md` 有 runner 設定欄位。
- [ ] `workspace/context/runner-status.md` 有成功率與 Last 5m 指標。
- [ ] `workspace/context/runner-audit.log` 有新增 JSONL 紀錄。

## 5) 灰度策略（建議）

- Step A：`SCHEDULE_USE_RUNNER=true`, `CHAT_USE_RUNNER_PERCENT=0`（先只切排程）。
- Step B：`CHAT_USE_RUNNER_PERCENT=10`（單人場景可直接 10）。
- Step C：觀察 24 小時後再提升（25 -> 50 -> 100）。

## 6) 回滾

快速回滾參數（不需改碼）：

```env
SCHEDULE_USE_RUNNER=false
CHAT_USE_RUNNER_PERCENT=0
```

套用：

```bash
docker compose --profile phase3 up -d
```

必要時完全回到 Phase 2：不帶 profile 啟動。
