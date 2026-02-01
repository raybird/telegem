import { exec } from 'child_process';
import { promisify } from 'util';
import type { AIAgent, AIAgentOptions } from './agent.js';

const execAsync = promisify(exec);

export class OpencodeAgent implements AIAgent {
    /**
     * 清除輸出中的 <thinking> 區塊和其他雜訊
     */
    private cleanOutput(text: string): string {
        // 1. 移除 <thinking>...</thinking> 區塊 (包含 XML 和 HTML 樣式)
        let cleaned = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

        // 2. 移除所有 ANSI 控制字元與顏色碼
        // eslint-disable-next-line no-control-regex
        cleaned = cleaned.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

        return cleaned.trim();
    }

    /**
     * 從 MCP Memory 檢索長期記憶 (模擬 Gemini BeforeAgent Hook)
     */
    private async retrieveMemory(prompt: string): Promise<string> {
        try {
            const projectDir = process.env.GEMINI_PROJECT_DIR || process.cwd();
            const hookPath = `${projectDir}/workspace/.gemini/hooks/retrieve-memory.sh`;
            const input = JSON.stringify({ prompt });

            console.log(`[Opencode] Retrieving long-term memory for prompt...`);

            // 執行 hook script (重用 Gemini 的檢索邏輯)
            const { stdout } = await execAsync(`echo '${input}' | bash "${hookPath}"`, {
                env: {
                    ...process.env,
                    GEMINI_PROJECT_DIR: process.env.GEMINI_PROJECT_DIR || process.cwd()
                }
            });

            // 解析 JSON 回應
            const response = JSON.parse(stdout.trim());

            if (response.systemMessage) {
                console.log(`[Opencode] Retrieved memory context: ${response.systemMessage.substring(0, 100)}...`);
                return response.systemMessage;
            }

            return '';
        } catch (error) {
            console.error('[Opencode] Failed to retrieve long-term memory:', error);
            return '';
        }
    }

    /**
     * 生成結構化摘要
     */
    async summarize(text: string, options?: AIAgentOptions): Promise<string> {
        try {
            const prompt = `請將以下內容整理成結構化摘要，使用以下格式（省略空白欄位）：

Goal: [目標或意圖，若無則省略]
Decision: [做出的決定，若無則省略]
Todo: [待辦事項，若無則省略]
Facts: [重要事實或資訊]

內容：
${text}

只輸出摘要，不要加任何說明。`;

            const safePrompt = JSON.stringify(prompt);
            let command = `echo ${safePrompt} | opencode run`;

            // 若有指定 model，加入參數
            if (options?.model) {
                command += ` --model ${JSON.stringify(options.model)}`;
            }

            console.log(`[Opencode Summarize] Starting...`);
            const { stdout, stderr } = await execAsync(command);

            if (stderr && stderr.trim().length > 0) {
                console.log(`[Opencode Summarize] stderr: ${stderr.substring(0, 200)}`);
            }

            const cleaned = this.cleanOutput(stdout);

            // 驗證摘要長度，過長則截斷
            if (cleaned.length > 280) {
                return cleaned.substring(0, 280) + '...';
            }

            return cleaned || '(摘要失敗)';
        } catch (error: any) {
            console.error('[Opencode] Summarization failed:', error.message);
            // Fallback: 截斷原文
            return text.substring(0, 200) + '...';
        }
    }

    /**
     * 呼叫 opencode run 處理訊息
     */
    async chat(prompt: string, options?: AIAgentOptions): Promise<string> {
        try {
            // 1. 呼叫 opencode 前先檢索記憶 (模擬 Gemini BeforeAgent Hook)
            const memoryContext = await this.retrieveMemory(prompt);

            // 2. 如果有記憶內容,注入到 prompt 前面
            const enrichedPrompt = memoryContext
                ? `${memoryContext}\n\n${prompt}`
                : prompt;

            const safePrompt = JSON.stringify(enrichedPrompt);

            // 使用 echo 透過 stdin 傳遞訊息,比直接作為參數更快
            // 暫時移除 stderr 過濾以便 debug
            let command = `echo ${safePrompt} | opencode run`;

            // 若有指定 model,加入參數
            if (options?.model) {
                command += ` --model ${JSON.stringify(options.model)}`;
                console.log(`[Opencode] Executing with model: ${options.model}`);
            } else {
                console.log(`[Opencode] Executing (default model)`);
            }

            // 取得絕對工作目錄路徑
            const workspacePath = process.env.GEMINI_PROJECT_DIR
                ? `${process.env.GEMINI_PROJECT_DIR}/workspace`
                : 'workspace';

            console.log(`[Opencode] Command: ${command}`);
            console.log(`[Opencode] Working directory: ${workspacePath}`);
            console.log(`[Opencode] Starting execution...`);

            // 設定 10 分鐘超時,並在 workspace/ 目錄執行
            const { stdout, stderr } = await execAsync(command, {
                timeout: 600000,
                cwd: workspacePath,
                env: {
                    ...process.env
                }
            });

            console.log(`[Opencode] Execution completed. Output length: ${stdout.length}`);

            // 顯示完整 stderr 以便 debug
            if (stderr && stderr.trim().length > 0) {
                console.log(`[Opencode] stderr:\n${stderr}`);
            }

            const cleaned = this.cleanOutput(stdout);

            if (!cleaned || cleaned.length === 0) {
                console.warn('[Opencode] Warning: No output after cleaning');
                console.log(`[Opencode] Raw stdout:\n${stdout.substring(0, 500)}...`);
                return "Opencode 執行完成,但沒有返回任何文字內容。";
            }

            console.log(`[Opencode] Reply length: ${cleaned.length}`);
            return cleaned;

        } catch (error: any) {
            console.error('[Opencode] Execution failed:');
            console.error(`  Message: ${error.message}`);
            console.error(`  Code: ${error.code}`);
            console.error(`  Signal: ${error.signal}`);
            console.error(`  Stack: ${error.stack}`);

            if (error.stdout) {
                console.error(`  Stdout: ${error.stdout.substring(0, 500)}`);
            }
            if (error.stderr) {
                console.error(`  Stderr: ${error.stderr.substring(0, 500)}`);
            }

            if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
                return '✨ 10分鐘內未完成';
            }

            return `Error calling Opencode: ${error.message}`;
        }
    }
}
