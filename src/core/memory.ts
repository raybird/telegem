import Database from 'better-sqlite3';
import path from 'path';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface Schedule {
  id: number;
  user_id: string;
  name: string;
  cron: string;
  prompt: string;
  created_at: number;
  is_active: boolean;
}

export class MemoryManager {
  private db: Database.Database;

  constructor() {
    // 初始化資料庫，允許由環境變數指定路徑
    const dbPath = this.resolveDbPath();
    this.db = new Database(dbPath); // verbose: console.log 可選

    // 啟用 WAL 模式 (Write-Ahead Logging) 提升效能與並發性
    this.db.pragma('journal_mode = WAL');

    this.initTable();
  }

  private resolveDbPath(): string {
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

  private initTable() {
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
    this.db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_user_timestamp ON messages(user_id, timestamp)`)
      .run();

    // 建立 FTS5 虛擬表格 (全文檢索)
    this.db
      .prepare(
        `
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        user_id,
        role,
        content,
        timestamp
      )
    `
      )
      .run();

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
  addMessage(userId: string, role: 'user' | 'model', content: string, summary?: string): void {
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
   * 使用 FTS5 全文檢索搜尋對話
   */
  search(userId: string, query: string, limit: number = 10): ChatMessage[] {
    const stmt = this.db.prepare(`
      SELECT m.role, m.content, m.timestamp
      FROM messages_fts f
      INNER JOIN messages m ON f.rowid = m.id
      WHERE f.user_id = ? AND f.content MATCH ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(userId, query, limit) as Array<{
      role: string;
      content: string;
      timestamp: number;
    }>;

    return rows.map((row) => ({
      role: row.role as 'user' | 'model',
      content: row.content,
      timestamp: row.timestamp
    }));
  }

  /**
   * 清除特定使用者的記憶
   */
  clear(userId: string): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE user_id = ?');
    stmt.run(userId);

    // 同步清除 FTS5
    const ftsStmt = this.db.prepare('DELETE FROM messages_fts WHERE user_id = ?');
    ftsStmt.run(userId);
  }

  /**
   * 新增排程任務
   */
  addSchedule(userId: string, name: string, cron: string, prompt: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO schedules (user_id, name, cron, prompt, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(userId, name, cron, prompt, Date.now());
    return result.lastInsertRowid as number;
  }

  /**
   * 取得所有啟用中的排程
   */
  getActiveSchedules(): Schedule[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id, name, cron, prompt, created_at, is_active
      FROM schedules
      WHERE is_active = 1
    `);
    const rows = stmt.all() as Array<{
      id: number;
      user_id: string;
      name: string;
      cron: string;
      prompt: string;
      created_at: number;
      is_active: number;
    }>;

    return rows.map((row) => ({
      ...row,
      is_active: row.is_active === 1
    }));
  }

  /**
   * 取得特定使用者的所有排程
   */
  getUserSchedules(userId: string): Schedule[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id, name, cron, prompt, created_at, is_active
      FROM schedules
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(userId) as Array<{
      id: number;
      user_id: string;
      name: string;
      cron: string;
      prompt: string;
      created_at: number;
      is_active: number;
    }>;

    return rows.map((row) => ({
      ...row,
      is_active: row.is_active === 1
    }));
  }

  /**
   * 刪除排程
   */
  removeSchedule(id: number): void {
    const stmt = this.db.prepare('DELETE FROM schedules WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 切換排程的啟用狀態
   */
  toggleSchedule(id: number, isActive: boolean): void {
    const stmt = this.db.prepare('UPDATE schedules SET is_active = ? WHERE id = ?');
    stmt.run(isActive ? 1 : 0, id);
  }

  /**
   * 取得使用者最後一次對話的時間戳
   * @param userId 使用者 ID
   * @returns 最後對話的 timestamp，若無紀錄則返回 null
   */
  getLastMessageTime(userId: string): number | null {
    const stmt = this.db.prepare(`
      SELECT MAX(timestamp) as lastTime
      FROM messages
      WHERE user_id = ?
    `);
    const row = stmt.get(userId) as { lastTime: number | null } | undefined;
    return row?.lastTime || null;
  }

  /**
   * 取得指定時間範圍內的對話歷史 (供追蹤系統使用)
   * @param userId 使用者 ID
   * @param hours 往前查詢的小時數
   */
  getExtendedHistory(userId: string, hours: number = 24): ChatMessage[] {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    const stmt = this.db.prepare(`
      SELECT role, content, timestamp
      FROM messages
      WHERE user_id = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(userId, cutoffTime) as Array<{
      role: string;
      content: string;
      timestamp: number;
    }>;

    return rows.map((row) => ({
      role: row.role as 'user' | 'model',
      content: row.content,
      timestamp: row.timestamp
    }));
  }

  /**
   * 取得記憶統計資訊
   */
  getStats(userId: string): { totalMessages: number; lastActive: number } {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count, MAX(timestamp) as last_active
      FROM messages
      WHERE user_id = ?
    `);
    const result = stmt.get(userId) as { count: number; last_active: number };
    return {
      totalMessages: result.count || 0,
      lastActive: result.last_active || 0
    };
  }

  /**
   * 刪除最近的 N 則對話
   */
  deleteRecentMessages(userId: string, count: number): number {
    // 1. 找出要刪除的 ID
    const selectStmt = this.db.prepare(`
      SELECT id FROM messages
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = selectStmt.all(userId, count) as { id: number }[];

    if (rows.length === 0) return 0;

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');

    // 2. 刪除 messages
    const deleteStmt = this.db.prepare(`
      DELETE FROM messages WHERE id IN (${placeholders})
    `);
    deleteStmt.run(...ids);

    // 3. 刪除 FTS5
    const deleteFtsStmt = this.db.prepare(`
      DELETE FROM messages_fts WHERE rowid IN (${placeholders})
    `);
    deleteFtsStmt.run(...ids);

    return ids.length;
  }
}
