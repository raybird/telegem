---
name: memory
description: Manage and search AI long-term memory.
---

# Memory Management Skill - 記憶管理工具

### 概述
這組工具讓你可以管理自己的「長期記憶」。當你覺得對話脈絡不足、或是使用者要求你遺忘某些內容時，請使用此工具。

### 工具位置
```bash
node dist/tools/memory-cli.js
```

### 可用指令

#### 1. 搜尋記憶 (Search)
當你需要回想過去的專案細節、使用者偏好或之前的對話內容時，請使用此指令。

```bash
node dist/tools/memory-cli.js search "關鍵字"
```

**範例**：
- 使用者問：「我們上次決定的 API 格式是什麼？」
- 你執行：`node dist/tools/memory-cli.js search "API 格式"`

#### 2. 查看狀態 (Stats)
查看目前記憶庫的使用狀況。

```bash
node dist/tools/memory-cli.js stats
```

#### 3. 遺忘最近對話 (Forget)
當使用者說「當我沒說」、「修正剛才的資訊」或是你發現自己記住了錯誤的資訊時，可以使用此指令刪除最近的幾則對話。

```bash
node dist/tools/memory-cli.js forget <數量>
```

**範例**：
- `node dist/tools/memory-cli.js forget 2` (刪除最近 2 則訊息)

#### 4. 清除所有記憶 (Clear)
**⚠️ 危險操作**：這會刪除該使用者的**所有**對話紀錄。通常只在使用者明確要求「重置所有記憶」時才使用。

```bash
node dist/tools/memory-cli.js clear --force
```

### 最佳實踐
1. **主動搜尋**：不要只依賴被動提供的 Context。如果使用者的問題涉及之前的對話，請主動搜尋。
2. **自我修正**：如果你發現自己記錯了，或是使用者糾正了資訊，可以先用 `forget` 刪除錯誤記憶，再回答正確內容。
3. **隱私尊重**：當使用者要求刪除特定話題時，請務必執行。
