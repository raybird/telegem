import { spawn } from 'child_process';
import type { AIAgent, AIAgentOptions } from './agent.js';

type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  stdin?: string;
};

function runProcess(command: string, args: string[], options: RunOptions = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const timer = options.timeoutMs
      ? setTimeout(() => {
        child.kill('SIGTERM');
        const err: any = new Error('Process timed out');
        err.code = 'ETIMEDOUT';
        reject(err);
      }, options.timeoutMs)
      : null;

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (signal) {
        const err: any = new Error(`Process terminated with signal ${signal}`);
        err.signal = signal;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      if (code && code !== 0) {
        const err: any = new Error(`Process exited with code ${code}`);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });

    if (options.stdin && child.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin?.end();
  });
}

export class GeminiAgent implements AIAgent {
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

      const args = ['-p', prompt];

      // 若有指定 model，加入參數
      if (options?.model) {
        args.push('--model', options.model);
      }

      const { stdout } = await runProcess('gemini', args);
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
   * @param options 選項，可指定 model
   * @returns Gemini 的回應文字
   */
  async chat(prompt: string, options?: AIAgentOptions): Promise<string> {
    try {
      // 判斷是否為 passthrough 指令（如 /compress, /compact）
      const isPassthrough = options?.isPassthroughCommand === true;

      let stdout: string;
      let stderr: string;

      if (isPassthrough) {
        // Passthrough 指令：透過 stdin 傳遞，不使用 -p 參數
        // 這樣 Gemini CLI 會將 /compress 視為互動式指令，而非對話內容
        console.log(`[Gemini] isPassthroughCommand: true`);
        console.log(`[Gemini] Original prompt: ${prompt}`);
        console.log(`[Gemini] Executing passthrough via stdin (no -p): gemini --yolo -r`);

        const result = await runProcess('gemini', ['--yolo', '-r', '-p', prompt], {
          timeoutMs: 600000,
          cwd: 'workspace',
          env: {
            ...process.env,
            GEMINI_PROJECT_DIR: process.env.GEMINI_PROJECT_DIR || process.cwd()
          },
          stdin: `${prompt}\n`  // 透過 stdin 傳入指令
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } else {
        // 一般對話：使用陣列參數傳遞
        // 開啟 --yolo 模式，允許自動執行所有工具 (搜尋、讀取檔案、執行指令等)
        // 使用 -p 進入非互動模式
        // 使用 --resume 接續上次 session，減少重複注入記憶
        const args = ['--yolo', '-r', '-p', prompt];

        // 若有指定 model，加入參數
        if (options?.model) {
          args.push('--model', options.model);
          console.log(`[Gemini] Executing (YOLO Mode) with model: ${options.model}`);
        } else {
          console.log(`[Gemini] Executing (YOLO Mode): gemini --yolo -p ...`);
        }

        // 設定 10 分鐘超時，並在 workspace/ 目錄執行，避免意外修改源碼
        const result = await runProcess('gemini', args, {
          timeoutMs: 600000,
          cwd: 'workspace',
          env: {
            ...process.env,
            GEMINI_PROJECT_DIR: process.env.GEMINI_PROJECT_DIR || process.cwd()
          }
        });
        stdout = result.stdout;
        stderr = result.stderr;
      }

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
