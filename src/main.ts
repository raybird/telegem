import dotenv from 'dotenv';
import { TelegramConnector } from './connectors/telegram.js';
import { GeminiAgent } from './core/gemini.js';
import { MemoryManager } from './core/memory.js';
import { Scheduler } from './core/scheduler.js';
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
  const scheduler = new Scheduler(memory, gemini, telegram);

  // 啟動排程器
  await scheduler.init();

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

    if (msg.content.trim() === '/reset') {
      memory.clear(userId);
      await telegram.sendMessage(userId, "🧹 記憶已清除。");
      return;
    }

    // 列出所有排程
    if (msg.content.trim() === '/list_schedules') {
      const schedules = scheduler.listSchedules(userId);
      if (schedules.length === 0) {
        await telegram.sendMessage(userId, "📋 目前沒有任何排程。");
      } else {
        const list = schedules.map((s, idx) =>
          `${idx + 1}. [ID: ${s.id}] ${s.name}\n   ⏰ Cron: ${s.cron}\n   📝 Prompt: ${s.prompt}\n   ${s.is_active ? '✅ 啟用中' : '❌ 已停用'}`
        ).join('\n\n');
        await telegram.sendMessage(userId, `📋 您的排程列表：\n\n${list}`);
      }
      return;
    }

    // 刪除排程（格式：/remove_schedule <id>）
    if (msg.content.trim().startsWith('/remove_schedule ')) {
      const parts = msg.content.trim().split(' ');
      if (parts.length !== 2) {
        await telegram.sendMessage(userId, "❌ 格式錯誤。使用範例：/remove_schedule 1");
        return;
      }
      const id = parseInt(parts[1], 10);
      if (isNaN(id)) {
        await telegram.sendMessage(userId, "❌ ID 必須是數字。");
        return;
      }
      try {
        scheduler.removeSchedule(id);
        await telegram.sendMessage(userId, `✅ 已刪除排程 #${id}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await telegram.sendMessage(userId, `❌ 刪除失敗：${errMsg}`);
      }
      return;
    }

    // 新增排程（格式：/add_schedule <name>|<cron>|<prompt>）
    if (msg.content.trim().startsWith('/add_schedule ')) {
      const raw = msg.content.replace('/add_schedule ', '').trim();
      const parts = raw.split('|').map(p => p.trim());
      if (parts.length !== 3) {
        await telegram.sendMessage(userId,
          "❌ 格式錯誤。使用範例：\n/add_schedule 早安問候|0 9 * * *|早安！今天天氣如何？");
        return;
      }
      const [name, cron, prompt] = parts;
      try {
        const id = scheduler.addSchedule(userId, name, cron, prompt);
        await telegram.sendMessage(userId, `✅ 成功新增排程 #${id}：${name}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await telegram.sendMessage(userId, `❌ 新增失敗：${errMsg}`);
      }
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