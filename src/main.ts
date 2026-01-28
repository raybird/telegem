import dotenv from 'dotenv';
import { TelegramConnector } from './connectors/telegram.js';
import { GeminiAgent } from './core/gemini.js';
import { MemoryManager } from './core/memory.js';
import type { UnifiedMessage } from './types/index.js';

// 載入環境變數
dotenv.config();

async function bootstrap() {
  console.log('🚀 Starting Moltbot Lite (YOLO Agent + Stream UX)...');

  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID;

  if (!TELEGRAM_TOKEN || !ALLOWED_USER_ID) {
    console.error('❌ Missing environment variables.');
    process.exit(1);
  }

  // 初始化元件
  const telegram = new TelegramConnector(TELEGRAM_TOKEN, [ALLOWED_USER_ID]);
  const gemini = new GeminiAgent();
  const memory = new MemoryManager();

  // 設定訊息處理邏輯
  telegram.onMessage(async (msg: UnifiedMessage) => {
    console.log(`📩 [${msg.sender.platform}] ${msg.sender.name}: ${msg.content}`);
    const userId = msg.sender.id;

    if (msg.content.trim() === '/reset') {
      memory.clear(userId);
      await telegram.sendMessage(userId, "🧹 記憶已清除。");
      return;
    }

    // UX: 先發送 "Thinking..." 佔位訊息
    let placeholderMsgId = '';
    try {
      placeholderMsgId = await telegram.sendPlaceholder(userId, "🤔 Thinking...");
    } catch (e) {
      console.warn("Failed to send placeholder", e);
    }

    try {
      // 1. 存入使用者訊息
      memory.addMessage(userId, 'user', msg.content);

      // 2. 準備 Context
      const historyContext = memory.getHistoryContext(userId);
      
      // 3. 組合 Prompt
      const fullPrompt = `
System: 你是 Moltbot，一個具備強大工具執行能力的本地 AI 助理。
當使用者要求你搜尋網路、查看檔案或執行指令時，請善用你手邊的工具（如 google_search, read_file 等）。
現在已經開啟了 YOLO 模式，你的所有工具調用都會被自動允許。
請用繁體中文回應。

Conversation History:
${historyContext}

AI Response:
`.trim();

      // 4. 呼叫 Gemini CLI
      const response = await gemini.chat(fullPrompt);
      
      console.log(`🤖 [Gemini] Reply length: ${response.length}`);

      // 5. 存入 AI 回應
      if (response && !response.startsWith('Error')) {
          memory.addMessage(userId, 'model', response);
      }

      // 6. 更新訊息 (取代 Thinking...)
      if (placeholderMsgId) {
        await telegram.editMessage(userId, placeholderMsgId, response);
      } else {
        // 如果佔位訊息發送失敗，就直接發新的
        await telegram.sendMessage(userId, response);
      }

    } catch (error) {
      console.error('❌ Error processing message:', error);
      const errorMsg = "Sorry, I encountered an error while exercising my powers.";
      
      if (placeholderMsgId) {
        await telegram.editMessage(userId, placeholderMsgId, errorMsg);
      } else {
        await telegram.sendMessage(userId, errorMsg);
      }
    }
  });

  // 啟動連接器
  await telegram.initialize();
}

bootstrap().catch(err => {
  console.error('❌ Fatal Error:', err);
});