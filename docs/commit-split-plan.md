# 建議 Commit 切分（不 push）

以下是目前變更的建議切分，目標是讓每個 commit 可讀、可回滾。

## Commit 1 - Scheduler 穩定化與操作規範

建議檔案：

- `src/tools/scheduler-cli.ts`
- `src/main.ts`（僅 scheduler health 與 early context 相關段落）
- `docs/scheduler-operation-runbook.md`
- `docs/migration-log.md`（對應 Phase 1 區段）
- `README.md`（scheduler `exec/run`、`reload/health` 片段）

建議訊息：

`stabilize scheduler reload path and add runtime health checks`

## Commit 2 - Context 邊界重整（Phase 2）

建議檔案：

- `Dockerfile`
- `verify-docker.sh`
- `src/main.ts`（context snapshots 與 prompt 邊界）
- `docs/docker-refactor-roadmap.md`
- `docs/runtime-boundary-and-security.md`
- `README.md`（context 說明段落）

建議訊息：

`introduce workspace context snapshots and remove src symlink dependency`

## Commit 3 - Runner 拆分與 canary（Phase 3）

建議檔案：

- `src/runner.ts`
- `src/core/agent.ts`
- `docker-compose.yml`
- `docker-compose.override.yml`
- `package.json`
- `.env.example`
- `.env.production.example`
- `docs/phase3-compose-profile.md`
- `docs/deployment-cutover-checklist.md`
- `docs/migration-log.md`（對應 Phase 3 區段）

建議訊息：

`add agent-runner service with secure canary routing and observability`

## 注意事項

- `README.md` 目前是 `MM`，commit 前先人工確認 staged 與 unstaged 區塊不要互相污染。
- 建議先排除不該納入版本控制的資料夾：`.agent/`, `.codex/`, `.gemini/`, `.opencode/`, `workspace/context/`。
- 本文件只提供切分策略，不會自動執行 `git add/commit`。
