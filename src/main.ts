import dotenv from 'dotenv';
import { TelegramConnector } from './connectors/telegram.js';
import { CommandRouter } from './core/command-router.js';
import { GeminiAgent } from './core/gemini.js';
import { MemoryManager } from './core/memory.js';
import { Scheduler } from './core/scheduler.js';
import type { UnifiedMessage } from './types/index.js';

// 載入環境變數
dotenv.config();

async function bootstrap() {
  console.log('🚀 Starting TeleGem (YOLO Agent + Stream UX)...');

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
  const scheduler = new Scheduler(memory, gemini, telegram);
  const commandRouter = new CommandRouter();



  // 註冊優雅關閉處理器
  process.on('SIGINT', () => {
    console.log('\n[System] Shutting down gracefully...');
    scheduler.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[System] Shutting down gracefully...');
    scheduler.shutdown();
    process.exit(0);
  });

  // 設定訊息處理邏輯
  telegram.onMessage(async (msg: UnifiedMessage) => {
    console.log(`📩 [${msg.sender.platform}] ${msg.sender.name}: ${msg.content}`);
    const userId = msg.sender.id;

    // 重置沉默計時器 (30 分鐘無訊息後觸發追蹤提醒)
    scheduler.resetSilenceTimer(userId);

    const commandHandled = await commandRouter.handleMessage(msg, {
      connector: telegram,
      memory,
      scheduler
    });
    if (commandHandled) {
      return;
    }

    // UX: 先發送 "Thinking..." 佔位訊息，並啟動輪播
    let placeholderMsgId = '';
    let thinkingInterval: NodeJS.Timeout | null = null;

    const thinkingMessages = [
      "🤔 思考中...",
      "🧠 正在理解問題...",
      "🔍 搜尋相關資訊...",
      "⚡ 處理中...",
      "💭 組織回答...",
      "🎯 分析脈絡..."
    ];
    let messageIndex = 0;

    try {
      placeholderMsgId = await telegram.sendPlaceholder(userId, thinkingMessages[0]!);

      // 每 3 秒切換一次訊息
      if (placeholderMsgId) {
        thinkingInterval = setInterval(async () => {
          messageIndex = (messageIndex + 1) % thinkingMessages.length;
          try {
            await telegram.editMessage(userId, placeholderMsgId, thinkingMessages[messageIndex]!);
          } catch (e) {
            console.warn("Failed to update thinking message", e);
          }
        }, 3000);
      }
    } catch (e) {
      console.warn("Failed to send placeholder", e);
    }

    try {
      // 1. 存入使用者訊息 (長文自動摘要)
      const userContentLength = msg.content.length;
      let userSummary: string | undefined;

      if (userContentLength > 800) {
        console.log(`📝 [Memory] User input is long (${userContentLength} chars), generating summary...`);
        userSummary = await gemini.summarize(msg.content);
      }

      memory.addMessage(userId, 'user', msg.content, userSummary);

      // 2. 準備 Context
      const historyContext = memory.getHistoryContext(userId);

      // 3. 組合 Prompt
      const fullPrompt = `
System: 你是 TeleGem，一個具備強大工具執行能力的本地 AI 助理。
當使用者要求你搜尋網路、查看檔案或執行指令時，請善用你手邊的工具（如 google_search, read_file 等）。
現在已經開啟了 YOLO 模式，你的所有工具調用都會被自動允許。
請用繁體中文回應。

【記憶管理】
你只能看到最近 5 則對話的摘要或原文。如果你需要回想更早之前的資訊，請執行以下指令：
node dist/tools/search_memory.js "關鍵字"
這會從資料庫搜尋相關的歷史對話並顯示給你。

【知識管理 - 重要】
你有 MCP Memory 工具可以儲存長期知識與關係：
- 當對話包含重要資訊（如：使用者偏好、專案細節、重要決策）時，請主動使用 create_entities 儲存
- 當發現實體間的關係時，使用 create_relations 建立連結
- 需要回想相關知識時，使用 search_entities 搜尋
- 在對話結束前，如果有值得記住的內容，請務必儲存到 Memory

【工作目錄限制 - 重要】
- 你的當前工作目錄是 workspace/
- ⚠️ 不要修改或執行 ../src/ 目錄下的任何檔案
- 所有臨時檔案請放在 temp/ 目錄
- 如需讀取專案資訊，請使用完整路徑（例如：../src/core/scheduler.ts）

Conversation History:
${historyContext}

AI Response:
`.trim();

      // 4. 呼叫 Gemini CLI
      const response = await gemini.chat(fullPrompt);

      console.log(`🤖 [Gemini] Reply length: ${response.length}`);

      // 5. 存入 AI 回應 (長文自動摘要)
      if (response && !response.startsWith('Error')) {
        const responseLength = response.length;
        let responseSummary: string | undefined;

        if (responseLength > 800) {
          console.log(`📝 [Memory] AI response is long (${responseLength} chars), generating summary...`);
          responseSummary = await gemini.summarize(response);
        }

        memory.addMessage(userId, 'model', response, responseSummary);
      }

      // 6. 停止輪播並更新訊息 (取代 Thinking...)
      if (thinkingInterval) {
        clearInterval(thinkingInterval);
      }

      if (placeholderMsgId) {
        await telegram.editMessage(userId, placeholderMsgId, response);
      } else {
        // 如果佔位訊息發送失敗，就直接發新的
        await telegram.sendMessage(userId, response);
      }

    } catch (error) {
      console.error('❌ Error processing message:', error);
      const errorMsg = "Sorry, I encountered an error while exercising my powers.";

      // 停止輪播
      if (thinkingInterval) {
        clearInterval(thinkingInterval);
      }

      if (placeholderMsgId) {
        await telegram.editMessage(userId, placeholderMsgId, errorMsg);
      } else {
        await telegram.sendMessage(userId, errorMsg);
      }
    }
  });

  // 啟動連接器 (確保 bot instance 存在)
  await telegram.initialize();

  // 啟動排程器 (可能需要發送歡迎訊息)
  await scheduler.init();
}

bootstrap().catch(err => {
  console.error('❌ Fatal Error:', err);
});

// Trigger restart to load new schedules