# 記憶系統改進計畫：混合式短期記憶（擴充版）

## 📌 當前問題

### 現況分析

- **檔案位置**: `src/core/memory.ts:22`
- **當前設定**: `MAX_HISTORY = 5`，只保留最近 5 則對話作為 context
- **摘要機制**: 只對超過 800 字元的訊息生成摘要，短訊息沒有摘要，超出範圍後直接遺失

### 主要痛點

1. **上下文連貫性不足** - 5 則對話覆蓋範圍太短，AI 容易忘記剛提過的事情
2. **資訊遺失** - 舊對話沒有滾動摘要，一旦超出範圍就永久遺失
3. **Token 效率未優化** - 短訊息沒有壓縮，舊對話原文堆疊會浪費 context
4. **摘要不結構化** - 自由文本摘要容易漏掉決策、待辦與偏好等關鍵資訊

---

## 🎯 改進方案：混合式短期記憶

### 設計原則

根據實務經驗，採用「原文 + 滾動摘要」的混合策略：

- **維持上下文連貫** - 擴充到 15 則對話，避免信息中斷
- **控制 Token 成本** - 舊內容用摘要壓縮，避免短訊息堆疊
- **保留關鍵細節** - 最新對話用完整原文，避免摘要遺失重要資訊
- **結構化摘要** - 摘要格式固定，避免關鍵資訊被吞掉

### 核心策略

```
對話歷史 (由舊到新)
├─ [0-9]   舊對話 (10則) → 結構化摘要 + [Summary] 標記
└─ [10-14] 新對話 (5則)  → 完整原文 (無壓縮)
```

---

## 🔧 實作細節

### 1. 修改常數定義 (`src/core/memory.ts`)

```typescript
export class MemoryManager {
  private db: Database.Database;
  private readonly MAX_HISTORY = 15; // 擴充到 15 則
  private readonly FULL_TEXT_COUNT = 5; // 保留最新 5 則原文
  private readonly SUMMARY_MAX_LEN = 280; // 結構化摘要上限（避免過長）
  // ...
}
```

### 2. 重寫 `getHistoryContext()` 方法

```typescript
/**
 * 取得混合式歷史紀錄 Prompt
 * - 最舊的 10 則：使用「結構化摘要」(summary)
 * - 最新的 5 則：一律用完整原文
 * - 摘要不足時仍保留原文，但標記為 [Old]
 */
getHistoryContext(userId: string): string {
  const stmt = this.db.prepare(`
    SELECT role, content, summary
    FROM messages
    WHERE user_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(userId, this.MAX_HISTORY) as {
    role: string;
    content: string;
    summary: string | null;
  }[];

  if (rows.length === 0) {
    return '';
  }

  // 反轉為 (最舊 -> 最新)
  rows.reverse();

  // 分割為舊對話和新對話
  const older = rows.slice(0, -this.FULL_TEXT_COUNT); // 較舊的
  const recent = rows.slice(-this.FULL_TEXT_COUNT);  // 最新 5 則

  // 較舊的：優先用 summary，沒有時標記 [Old]
  const olderContext = older.map(msg => {
    const roleName = msg.role === 'user' ? 'User' : 'AI';
    const displayText = msg.summary || msg.content;
    const prefix = msg.summary ? '[Summary]' : '[Old]';
    return `${roleName}${prefix}: ${displayText}`;
  }).join('\n');

  // 最新的：一律用原文
  const recentContext = recent.map(msg => {
    const roleName = msg.role === 'user' ? 'User' : 'AI';
    return `${roleName}: ${msg.content}`;
  }).join('\n');

  return `${olderContext}\n\n=== Recent Context (最新 5 則原文) ===\n${recentContext}`;
}
```

### 3. 新增摘要策略（動態摘要）

**策略目標**：短訊息也能被適度壓縮，避免舊對話原文堆疊。

建議觸發條件（擇一或組合）：
- 訊息包含工具輸出/清單/程式碼段落
- 超過 N 句或 N 行（例如 6 句或 10 行）
- 短訊息但包含關鍵字（例如「決定」「下一步」「TODO」「優先」）

建議摘要格式（結構化）：
```
Summary:
- Goal: ...
- Decision: ...
- Todo: ...
- Facts: ...
```

> 備註：可以先在 `gemini.summarize` 內改為結構化摘要提示詞，確保 summary 格式穩定。

---

## 📊 預期效果

### ✅ 改進效益

| 指標             | 改進前          | 改進後             |
| ---------------- | --------------- | ------------------ |
| Context 覆蓋範圍 | 5 則對話        | 15 則對話          |
| 關鍵細節保留率   | 低 (舊對話遺失) | 高 (最新 5 則完整) |
| Token 使用效率   | 中等            | 高 (舊對話壓縮)    |
| 上下文連貫性     | 易中斷          | 穩定連續           |
| 摘要穩定性       | 低（自由文本）  | 高（結構化）       |

### 實際應用場景

**場景 1: 多輪對話**

```
User: 幫我查 package.json 依賴
AI: [執行 ls/read_file] ...
User: 這些依賶有什麼特別的用途？
AI: [需要回憶第 6 則] 可透過 search_memory 回顧
```

→ 改進後：AI 直接從 context 看到第 6 則內容

**場景 2: 長專案討論**

```
[1-10則] 專案背景、需求討論 (摘要儲存)
[11-15則] 當前實作細節 (完整保留)
```

→ AI 能理解專案脈絡，又能精確回應最新問題

---

## ⚠️ 潛在限制

### 已知問題

1. **短訊息無摘要** - 沒有 `summary` 欄位的短訊息會以 `[Old]` 前綴完整顯示，略佔用 token
2. **未結構化摘要** - 摘要目前是自由文字，未區分「任務/待辦/偏好」等結構
3. **摘要一致性** - 需要統一的摘要格式提示詞，避免不同風格

### 未來擴充方向

- **結構化摘要** - 加入欄位記錄 `decision`、`todo`、`preferences`
- **智慧重要性分級** - 重要資訊（使用者偏好、設定）不應被踢出 context
- **動態摘要重生成** - 當舊對話被壓縮多次時，重新生成更高層次的摘要
- **摘要衝突處理** - 發現摘要與新訊息矛盾時，允許覆寫或標記修正

---

## 🚀 實作檢查清單

- [ ] 修改 `src/core/memory.ts` 常數定義
- [ ] 重寫 `getHistoryContext()` 方法
- [ ] 更新摘要提示詞為「結構化摘要」
- [ ] 加入動態摘要觸發條件（短訊息規則）
- [ ] 測試：驗證 15 則對話正確分割
- [ ] 測試：確認最新 5 則使用原文
- [ ] 測試：檢查舊對話優先使用 summary
- [ ] 測試：確認 summary 不超過 `SUMMARY_MAX_LEN`
- [ ] 測試：執行 `npm run lint` 確認程式碼品質
- [ ] 測試：執行 `npm run build` 確認編譯成功

---

## 📝 相關檔案

- **主要修改**: `src/core/memory.ts`
- **相關類別**: `src/core/gemini.ts` (summarize 方法)
- **使用位置**: `src/main.ts:107` (呼叫 getHistoryContext)
- **資料庫結構**: `messages` 表格 (`content`, `summary` 欄位)
