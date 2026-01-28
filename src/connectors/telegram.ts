import { Telegraf } from 'telegraf';
import type { Connector, UnifiedMessage } from '../types/index.js';

export class TelegramConnector implements Connector {
  public name = 'Telegram';
  private bot: Telegraf;
  private messageHandler: ((msg: UnifiedMessage) => void) | null = null;
  private allowedUserIds: string[];

  constructor(token: string, allowedUserIds: string[]) {
    this.bot = new Telegraf(token);
    this.allowedUserIds = allowedUserIds;
  }

  async initialize(): Promise<void> {
    console.log(`[Telegram] Initializing with allowed users: ${this.allowedUserIds.join(', ')}`);

    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      // 白名單檢查
      if (!this.allowedUserIds.includes(userId)) {
        console.warn(`[Telegram] Blocked unauthorized access from: ${userId} (${ctx.from.first_name})`);
        return; 
      }

      if (this.messageHandler) {
        const unifiedMsg: UnifiedMessage = {
          id: ctx.message.message_id.toString(),
          content: ctx.message.text,
          sender: {
            id: userId,
            name: ctx.from.first_name || 'Unknown',
            platform: 'telegram'
          },
          timestamp: ctx.message.date * 1000,
          raw: ctx.message
        };
        this.messageHandler(unifiedMsg);
      }
    });

    this.bot.launch(() => {
      console.log('[Telegram] Bot launched successfully!');
    });

    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  onMessage(handler: (msg: UnifiedMessage) => void): void {
    this.messageHandler = handler;
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text);
    } catch (error) {
      console.error(`[Telegram] Failed to send message to ${chatId}:`, error);
    }
  }

  async sendPlaceholder(chatId: string, text: string): Promise<string> {
    try {
      const msg = await this.bot.telegram.sendMessage(chatId, text);
      return msg.message_id.toString();
    } catch (error) {
      console.error(`[Telegram] Failed to send placeholder to ${chatId}:`, error);
      return '';
    }
  }

  async editMessage(chatId: string, messageId: string, newText: string): Promise<void> {
    try {
      // 轉換 messageId 為 number (Telegram API 要求 number)
      await this.bot.telegram.editMessageText(chatId, parseInt(messageId), undefined, newText);
    } catch (error) {
      console.error(`[Telegram] Failed to edit message ${messageId}:`, error);
      // 如果編輯失敗（例如訊息被刪除），嘗試發送一條新的
      await this.sendMessage(chatId, newText);
    }
  }
}
