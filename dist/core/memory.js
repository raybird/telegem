import Database from 'better-sqlite3';
import path from 'path';
export class MemoryManager {
    db;
    MAX_HISTORY = 5; // 讀取最近 5 則訊息作為 Context
    constructor() {
        // 初始化資料庫，允許由環境變數指定路徑
        const dbPath = this.resolveDbPath();
        this.db = new Database(dbPath); // verbose: console.log 可選
        // 啟用 WAL 模式 (Write-Ahead Logging) 提升效能與並發性
        this.db.pragma('journal_mode = WAL');
        this.initTable();
    }
    resolveDbPath() {
        const explicitPath = process.env.DB_PATH?.trim();
        if (explicitPath) {
            return path.resolve(explicitPath);
        }
        const dbDir = process.env.DB_DIR?.trim();
        if (dbDir) {
            return path.resolve(dbDir, 'moltbot.db');
        }
        return path.resolve(process.cwd(), 'moltbot.db');
    }
    initTable() {
        // 建立 messages 表格
        const stmt = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'model')),
        content TEXT NOT NULL,
        summary TEXT,
        timestamp INTEGER NOT NULL
      )
    `);
        stmt.run();
        // 建立索引加速查詢
        this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_user_timestamp ON messages(user_id, timestamp)`).run();
        // 建立 FTS5 虛擬表格 (全文檢索)
        this.db.prepare(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        user_id,
        role,
        content,
        timestamp
      )
    `).run();
        // 建立 schedules 表格
        const scheduleStmt = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        cron TEXT NOT NULL,
        prompt TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1))
      )
    `);
        scheduleStmt.run();
    }
    /**
     * 新增訊息到資料庫
     */
    addMessage(userId, role, content, summary) {
        const timestamp = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO messages (user_id, role, content, summary, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
        const result = stmt.run(userId, role, content, summary || null, timestamp);
        // 同步到 FTS5 表格
        const ftsStmt = this.db.prepare(`
      INSERT INTO messages_fts (rowid, user_id, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
        ftsStmt.run(result.lastInsertRowid, userId, role, content, timestamp);
    }
    /**
     * 取得格式化後的歷史紀錄 Prompt
     * 讀取該使用者最近 N 筆對話
     * 優先使用 summary（若存在），否則使用完整 content
     */
    getHistoryContext(userId) {
        // 1. 取出最近的 MAX_HISTORY 筆 (依照時間倒序取，這樣才能拿到最新的)
        const stmt = this.db.prepare(`
      SELECT role, content, summary 
      FROM messages 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
        const rows = stmt.all(userId, this.MAX_HISTORY);
        if (rows.length === 0) {
            return '';
        }
        // 2. 因為是倒序取出的 (最新 -> 最舊)，要反轉回 (最舊 -> 最新) 才能符合閱讀順序
        rows.reverse();
        // 3. 格式化為 Prompt (優先使用 summary)
        return rows.map(msg => {
            const roleName = msg.role === 'user' ? 'User' : 'AI';
            const displayText = msg.summary || msg.content;
            const prefix = msg.summary ? '[Summary]' : '';
            return `${roleName}${prefix}: ${displayText}`;
        }).join('\n');
    }
    /**
     * 使用 FTS5 全文檢索搜尋對話
     */
    search(userId, query, limit = 10) {
        const stmt = this.db.prepare(`
      SELECT m.role, m.content, m.timestamp
      FROM messages_fts f
      INNER JOIN messages m ON f.rowid = m.id
      WHERE f.user_id = ? AND f.content MATCH ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `);
        const rows = stmt.all(userId, query, limit);
        return rows.map(row => ({
            role: row.role,
            content: row.content,
            timestamp: row.timestamp
        }));
    }
    /**
     * 清除特定使用者的記憶
     */
    clear(userId) {
        const stmt = this.db.prepare('DELETE FROM messages WHERE user_id = ?');
        stmt.run(userId);
        // 同步清除 FTS5
        const ftsStmt = this.db.prepare('DELETE FROM messages_fts WHERE user_id = ?');
        ftsStmt.run(userId);
    }
    /**
     * 新增排程任務
     */
    addSchedule(userId, name, cron, prompt) {
        const stmt = this.db.prepare(`
      INSERT INTO schedules (user_id, name, cron, prompt, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
        const result = stmt.run(userId, name, cron, prompt, Date.now());
        return result.lastInsertRowid;
    }
    /**
     * 取得所有啟用中的排程
     */
    getActiveSchedules() {
        const stmt = this.db.prepare(`
      SELECT id, user_id, name, cron, prompt, created_at, is_active
      FROM schedules
      WHERE is_active = 1
    `);
        const rows = stmt.all();
        return rows.map(row => ({
            ...row,
            is_active: row.is_active === 1
        }));
    }
    /**
     * 取得特定使用者的所有排程
     */
    getUserSchedules(userId) {
        const stmt = this.db.prepare(`
      SELECT id, user_id, name, cron, prompt, created_at, is_active
      FROM schedules
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);
        const rows = stmt.all(userId);
        return rows.map(row => ({
            ...row,
            is_active: row.is_active === 1
        }));
    }
    /**
     * 刪除排程
     */
    removeSchedule(id) {
        const stmt = this.db.prepare('DELETE FROM schedules WHERE id = ?');
        stmt.run(id);
    }
    /**
     * 切換排程的啟用狀態
     */
    toggleSchedule(id, isActive) {
        const stmt = this.db.prepare('UPDATE schedules SET is_active = ? WHERE id = ?');
        stmt.run(isActive ? 1 : 0, id);
    }
}
//# sourceMappingURL=memory.js.map