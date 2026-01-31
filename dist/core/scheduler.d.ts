import { MemoryManager, type Schedule } from './memory.js';
import { GeminiAgent } from './gemini.js';
import type { Connector } from '../types/index.js';
export declare class Scheduler {
    private jobs;
    private memory;
    private gemini;
    private connector;
    constructor(memory: MemoryManager, gemini: GeminiAgent, connector: Connector);
    /**
     * 初始化排程器：從資料庫載入所有啟用的排程並啟動
     */
    init(): Promise<void>;
    /**
     * 啟動一個 cron 任務
     * @param schedule 排程資料
     */
    private startJob;
    /**
     * 從 MCP Memory 檢索長期記憶
     * 呼叫 retrieve-memory.sh 並解析結果
     */
    private retrieveLongTermMemory;
    /**
     * 執行排程任務
     */
    private executeTask;
    /**
     * 新增排程並立即啟動
     */
    addSchedule(userId: string, name: string, cron: string, prompt: string): number;
    /**
     * 刪除排程並停止對應的 Job
     */
    removeSchedule(id: number): void;
    /**
     * 取得所有排程（供使用者查詢）
     */
    listSchedules(userId: string): Schedule[];
    /**
     * 停止所有排程（於程式關閉時調用）
     */
    shutdown(): void;
}
//# sourceMappingURL=scheduler.d.ts.map