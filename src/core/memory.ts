import Database from 'better-sqlite3';
import path from 'path';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export class MemoryManager {
  private db: Database.Database;
  private readonly MAX_HISTORY = 20; // 讀取最近 20 則訊息作為 Context

  constructor() {
    // 初始化資料庫，檔案存在專案根目錄
    const dbPath = path.resolve(process.cwd(), 'moltbot.db');
    this.db = new Database(dbPath); // verbose: console.log 可選

    // 啟用 WAL 模式 (Write-Ahead Logging) 提升效能與並發性
    this.db.pragma('journal_mode = WAL');

    this.initTable();
  }

  private initTable() {
    // 建立 messages 表格
    const stmt = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'model')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
    stmt.run();
    
    // 建立索引加速查詢
    this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_user_timestamp ON messages(user_id, timestamp)`).run();
  }

  /**
   * 新增訊息到資料庫
   */
  addMessage(userId: string, role: 'user' | 'model', content: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (user_id, role, content, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(userId, role, content, Date.now());
  }

  /**
   * 取得格式化後的歷史紀錄 Prompt
   * 讀取該使用者最近 N 筆對話
   */
  getHistoryContext(userId: string): string {
    // 1. 取出最近的 MAX_HISTORY 筆 (依照時間倒序取，這樣才能拿到最新的)
    const stmt = this.db.prepare(`
      SELECT role, content 
      FROM messages 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(userId, this.MAX_HISTORY) as { role: string, content: string }[];

    if (rows.length === 0) {
      return '';
    }

    // 2. 因為是倒序取出的 (最新 -> 最舊)，要反轉回 (最舊 -> 最新) 才能符合閱讀順序
    rows.reverse();

    // 3. 格式化為 Prompt
    return rows.map(msg => {
      const roleName = msg.role === 'user' ? 'User' : 'AI';
      return `${roleName}: ${msg.content}`;
    }).join('\n');
  }

  /**
   * 清除特定使用者的記憶
   */
  clear(userId: string): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE user_id = ?');
    stmt.run(userId);
  }
}
