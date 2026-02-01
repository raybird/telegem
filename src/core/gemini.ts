import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GeminiAgent {
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
   * 生成結構化摘要
   * 格式固定為 Goal/Decision/Todo/Facts 欄位
   */
  async summarize(text: string): Promise<string> {
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
      const command = `gemini -p ${safePrompt}`;

      const { stdout } = await execAsync(command);
      const cleaned = this.cleanOutput(stdout);

      // 驗證摘要長度，過長則截斷
      if (cleaned.length > 280) {
        return cleaned.substring(0, 280) + '...';
      }

      return cleaned || '(摘要失敗)';
    } catch (error: any) {
      console.error('[Gemini] Summarization failed:', error);
      // Fallback: 截斷原文
      return text.substring(0, 200) + '...';
    }
  }

  /**
   * 呼叫系統的 gemini-cli 處理訊息
   * @param prompt 使用者的輸入
   * @returns Gemini 的回應文字
   */
  async chat(prompt: string): Promise<string> {
    try {
      const safePrompt = JSON.stringify(prompt);

      // 開啟 --yolo 模式，允許自動執行所有工具 (搜尋、讀取檔案、執行指令等)
      // 使用 -p 進入非互動模式
      const command = `gemini --yolo -p ${safePrompt}`;

      console.log(`[Gemini] Executing (YOLO Mode): ${command.substring(0, 50)}...`);

      // 設定 10 分鐘超時，並在 workspace/ 目錄執行，避免意外修改源碼
      const { stdout, stderr } = await execAsync(command, {
        timeout: 600000,
        cwd: 'workspace',
        env: {
          ...process.env,
          GEMINI_PROJECT_DIR: process.env.GEMINI_PROJECT_DIR || process.cwd()
        }
      });

      if (stderr && stderr.trim().length > 0) {
        // 工具執行的過程通常會輸出很多 stderr 資訊，這裡我們記錄下來但不中斷流程
        console.log(`[Gemini-Tools] Log: ${stderr}`);
      }

      // 使用統一的清洗器
      const cleaned = this.cleanOutput(stdout);

      return cleaned || "Gemini 執行完成，但沒有返回任何文字內容。";

    } catch (error: any) {
      console.error('[Gemini] Execution failed:', error);
      if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
        return '✨ 5分鐘內未完成';
      }
      return `Error calling Gemini: ${error.message}\nStderr: ${error.stderr || ''}`;
    }
  }
}
