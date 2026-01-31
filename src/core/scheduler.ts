import { Cron } from 'croner';
import { MemoryManager, type Schedule } from './memory.js';
import { GeminiAgent } from './gemini.js';
import type { Connector } from '../types/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class Scheduler {
    private jobs: Map<number, Cron> = new Map();
    private memory: MemoryManager;
    private gemini: GeminiAgent;
    private connector: Connector;

    constructor(memory: MemoryManager, gemini: GeminiAgent, connector: Connector) {
        this.memory = memory;
        this.gemini = gemini;
        this.connector = connector;
    }

    /**
     * 初始化排程器：從資料庫載入所有啟用的排程並啟動
     */
    async init(): Promise<void> {
        const schedules = this.memory.getActiveSchedules();
        console.log(`[Scheduler] Loading ${schedules.length} active schedule(s)...`);

        for (const schedule of schedules) {
            this.startJob(schedule);
        }
    }

    /**
     * 啟動一個 cron 任務
     * @param schedule 排程資料
     */
    private startJob(schedule: Schedule): void {
        // 如果已存在相同 ID 的 Job，先停止它（避免重複掛載）
        if (this.jobs.has(schedule.id)) {
            console.log(`[Scheduler] Stopping duplicate job #${schedule.id}`);
            this.jobs.get(schedule.id)?.stop();
            this.jobs.delete(schedule.id);
        }

        try {
            const job = new Cron(schedule.cron, async () => {
                console.log(`[Scheduler] Triggered: "${schedule.name}" (ID: ${schedule.id})`);
                await this.executeTask(schedule);
            });

            this.jobs.set(schedule.id, job);
            console.log(`[Scheduler] Started job #${schedule.id}: "${schedule.name}" with cron "${schedule.cron}"`);
        } catch (error) {
            console.error(`[Scheduler] Failed to start job #${schedule.id}:`, error);
        }
    }

    /**
     * 從 MCP Memory 檢索長期記憶
     * 呼叫 retrieve-memory.sh 並解析結果
     */
    private async retrieveLongTermMemory(prompt: string): Promise<string> {
        try {
            const hookPath = `${process.env.GEMINI_PROJECT_DIR}/.gemini/hooks/retrieve-memory.sh`;
            const input = JSON.stringify({ prompt });

            console.log(`[Scheduler] Retrieving long-term memory for prompt...`);

            // 執行 hook script
            const { stdout } = await execAsync(`echo '${input}' | bash "${hookPath}"`, {
                env: {
                    ...process.env,
                    GEMINI_PROJECT_DIR: process.env.GEMINI_PROJECT_DIR || process.cwd()
                }
            });

            // 解析 JSON 回應
            const response = JSON.parse(stdout.trim());

            if (response.systemMessage) {
                console.log(`[Scheduler] Retrieved memory context: ${response.systemMessage.substring(0, 100)}...`);
                return response.systemMessage;
            }

            return '';
        } catch (error) {
            console.error('[Scheduler] Failed to retrieve long-term memory:', error);
            return '';
        }
    }

    /**
     * 執行排程任務
     */
    private async executeTask(schedule: Schedule): Promise<void> {
        try {
            // 1. 準備 Context (載入使用者歷史記憶)
            const historyContext = this.memory.getHistoryContext(schedule.user_id);

            // 2. 檢索長期記憶 (MCP Memory)
            const longTermMemory = await this.retrieveLongTermMemory(schedule.prompt);

            // 3. 組合 Prompt
            const fullPrompt = `
System: 你是 Moltbot，一個具備強大工具執行能力的本地 AI 助理。
這是一個排程任務觸發的自動執行。
請用繁體中文回應。

${longTermMemory ? longTermMemory + '\n\n' : ''}Conversation History:
${historyContext}

Scheduled Task: ${schedule.name}
User Request: ${schedule.prompt}

AI Response:
`.trim();

            // 4. 呼叫 Gemini CLI
            const response = await this.gemini.chat(fullPrompt);
            console.log(`[Scheduler] Task #${schedule.id} completed. Response length: ${response.length}`);

            // 5. 儲存 AI 回應到記憶
            if (response && !response.startsWith('Error')) {
                this.memory.addMessage(schedule.user_id, 'model', response);
            }

            // 6. 將結果傳送給使用者
            const messageHeader = `🕐 [排程: ${schedule.name}]\n\n`;
            await this.connector.sendMessage(schedule.user_id, messageHeader + response);

        } catch (error) {
            console.error(`[Scheduler] Error executing task #${schedule.id}:`, error);
            await this.connector.sendMessage(
                schedule.user_id,
                `❌ 排程任務 "${schedule.name}" 執行失敗：${error}`
            );
        }
    }

    /**
     * 新增排程並立即啟動
     */
    addSchedule(userId: string, name: string, cron: string, prompt: string): number {
        const id = this.memory.addSchedule(userId, name, cron, prompt);
        const schedule: Schedule = {
            id,
            user_id: userId,
            name,
            cron,
            prompt,
            created_at: Date.now(),
            is_active: true
        };
        this.startJob(schedule);
        return id;
    }

    /**
     * 刪除排程並停止對應的 Job
     */
    removeSchedule(id: number): void {
        // 停止 Job
        if (this.jobs.has(id)) {
            this.jobs.get(id)?.stop();
            this.jobs.delete(id);
        }
        // 從資料庫刪除
        this.memory.removeSchedule(id);
        console.log(`[Scheduler] Removed schedule #${id}`);
    }

    /**
     * 取得所有排程（供使用者查詢）
     */
    listSchedules(userId: string): Schedule[] {
        return this.memory.getUserSchedules(userId);
    }

    /**
     * 停止所有排程（於程式關閉時調用）
     */
    shutdown(): void {
        console.log('[Scheduler] Shutting down all jobs...');
        for (const [id, job] of this.jobs.entries()) {
            job.stop();
            console.log(`[Scheduler] Stopped job #${id}`);
        }
        this.jobs.clear();
    }
}
