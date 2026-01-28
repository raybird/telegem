import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GeminiAgent {
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

      const { stdout, stderr } = await execAsync(command);

      if (stderr && stderr.trim().length > 0) {
        // 工具執行的過程通常會輸出很多 stderr 資訊，這裡我們記錄下來但不中斷流程
        console.log(`[Gemini-Tools] Log: ${stderr}`);
      }

      // 清除所有 ANSI 控制字元與顏色碼
      // eslint-disable-next-line no-control-regex
      const cleanOutput = stdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();

      return cleanOutput || "Gemini 執行完成，但沒有返回任何文字內容。";

    } catch (error: any) {
      console.error('[Gemini] Execution failed:', error);
      return `Error calling Gemini: ${error.message}\nStderr: ${error.stderr || ''}`;
    }
  }
}
