# 技術文件：整合 CLI Session 記憶機制

## 📅 更新日期：2026-02-06

## 📌 背景與動態
目前系統已從「純手動注入對話歷史」轉向「利用 CLI 原生 Session 管理」的混合模式。
- **Gemini**: 使用 `--resume`
- **Opencode**: 使用 `-c`

## 🛠️ 變更重點

### 1. 核心參數調整
- **gemini.ts**: 在 `chat()` 方法中添加 `--resume` 參數。這讓 Gemini CLI 自動尋找並接續最近的一筆 session。
- **opencode.ts**: 在 `chat()` 方法中添加 `-c` 參數，接續上次的執行狀態。

### 2. 記憶架構現況 (混合模式)
為了確保穩定性，目前採用以下三層記憶架構：
1. **CLI Native Session (New)**: 負責維持模型層級的對話連貫性與工具執行狀態。
2. **SQLite 短期注入 (Fallback)**: 保留 `getHistoryContext()`，注入最近 15 則對話摘要，作為 CLI session 遺失時的保險。
3. **MCP Memory (Long-term)**: 向量搜尋與知識圖譜，處理跨 session 的長期知識檢索。

## 🔍 後續追蹤重點 (Critical)

### 1. Session 清除機制 (/reset)
> [!WARNING]
> 目前 `/reset` 指令僅清除 SQLite 資料，**尚未實作**清除 CLI session 的功能。
- **Gemini**: 需研究如何透過指令或刪除檔案（如 `.gemini/sessions/`）來讓 `--resume` 重置。
- **Opencode**: 需確認清除對話串的具體方式。

### 2. Docker 持久性
需驗證在 `docker compose down` 或重新構建後，掛載的 volume 是否足以保留 CLI 的 session 狀態。

### 3. 跨 Provider 記憶轉發 (User Idea)
當系統偵測到 Provider 切換（例如從 Gemini 切換到 Opencode）時：
1. 先讓原本的 Provider 生成一份當前會話的 **Summary**。
2. 將此 Summary 作為 context 傳遞給新的 Provider。
3. 這樣可以確保切換大腦時，工作脈絡不會中斷。

## 🧪 驗證計畫
1. **重啟測試**: 確認服務重啟後 `AI 能否記得剛提過的名字`。
2. **Token 壓力測試**: 觀察在長對話下，若移除 SQLite 注入，CLI session 能否穩定維持對話深度。
3. **Provider 切換測試**: 在 Gemini 與 Opencode 間切換時的記憶中斷表現。

---

## 相關檔案
- `src/core/gemini.ts`
- `src/core/opencode.ts`
- `src/core/memory.ts`
- `src/main.ts`
