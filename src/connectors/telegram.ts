import { Telegraf } from 'telegraf';
import { Agent } from 'https';
import { createConnection } from 'net';
import fs from 'fs';
import type { Connector, UnifiedMessage } from '../types/index.js';

const DEFAULT_TELEGRAM_API_TIMEOUT_MS = 15000;
const DEFAULT_TELEGRAM_API_RETRY_COUNT = 1;
const DEFAULT_TELEGRAM_API_RETRY_DELAY_MS = 800;

class TelegramApiTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = 'TelegramApiTimeoutError';
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value?.trim() || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export class TelegramConnector implements Connector {
  public name = 'Telegram';
  private bot!: Telegraf;
  private messageHandler: ((msg: UnifiedMessage) => void) | null = null;
  private allowedUserIds: string[];
  private token: string;
  private apiTimeoutMs: number;
  private apiRetryCount: number;
  private apiRetryDelayMs: number;

  constructor(token: string, allowedUserIds: string[]) {
    this.token = token;
    this.allowedUserIds = allowedUserIds;
    this.apiTimeoutMs = parsePositiveInteger(
      process.env.TELEGRAM_API_TIMEOUT_MS,
      DEFAULT_TELEGRAM_API_TIMEOUT_MS
    );
    this.apiRetryCount = parsePositiveInteger(
      process.env.TELEGRAM_API_RETRY_COUNT,
      DEFAULT_TELEGRAM_API_RETRY_COUNT
    );
    this.apiRetryDelayMs = parsePositiveInteger(
      process.env.TELEGRAM_API_RETRY_DELAY_MS,
      DEFAULT_TELEGRAM_API_RETRY_DELAY_MS
    );
  }

  private splitMessage(text: string, limit: number = 4096): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    const lines = text.split('\n');

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > limit) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
        }

        // If a single line is too long, force split it
        if (line.length > limit) {
          for (let i = 0; i < line.length; i += limit) {
            chunks.push(line.substring(i, i + limit));
          }
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [text];
  }

  private probeIPv6(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection({
        host: 'api.telegram.org',
        port: 443,
        family: 6,
        timeout: 2000 // 2s connection timeout
      });

      socket.on('connect', () => {
        socket.end();
        resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private withTimeout<T>(task: Promise<T>, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TelegramApiTimeoutError(label, this.apiTimeoutMs));
      }, this.apiTimeoutMs);

      task
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof TelegramApiTimeoutError) {
      return true;
    }

    if (!error || typeof error !== 'object') {
      return false;
    }

    const err = error as {
      code?: string;
      message?: string;
      response?: { error_code?: number };
    };
    const code = err.code || '';
    const statusCode = err.response?.error_code;
    const message = err.message || '';

    if (
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'EAI_AGAIN' ||
      code === 'ECONNABORTED'
    ) {
      return true;
    }

    if (typeof statusCode === 'number' && (statusCode === 429 || statusCode >= 500)) {
      return true;
    }

    return /timeout|socket hang up|network error/i.test(message);
  }

  private async callTelegram<T>(
    label: string,
    operation: () => Promise<T>,
    options?: { retries?: number }
  ): Promise<T> {
    const retries = options?.retries ?? this.apiRetryCount;
    let attempt = 0;

    while (true) {
      attempt += 1;
      const startedAt = Date.now();

      try {
        const result = await this.withTimeout(operation(), label);
        const elapsed = Date.now() - startedAt;
        if (attempt > 1) {
          console.log(`[Telegram] ${label} succeeded on retry #${attempt - 1} (${elapsed}ms)`);
        } else {
          console.log(`[Telegram] ${label} succeeded (${elapsed}ms)`);
        }
        return result;
      } catch (error) {
        const elapsed = Date.now() - startedAt;
        const retryable = this.isRetryableError(error);
        const hasRetryLeft = attempt <= retries;

        console.warn(
          `[Telegram] ${label} failed (${elapsed}ms, attempt=${attempt}, retryable=${retryable}):`,
          error
        );

        if (!retryable || !hasRetryLeft) {
          throw error;
        }

        await this.sleep(this.apiRetryDelayMs);
      }
    }
  }

  private async sendChunk(chatId: string, chunk: string, chunkIndex: number, totalChunks: number) {
    const label = `sendMessage chat=${chatId} chunk=${chunkIndex + 1}/${totalChunks}`;
    await this.callTelegram(label, () => this.bot.telegram.sendMessage(chatId, chunk));
  }

  async initialize(): Promise<void> {
    const ipv6Available = await this.probeIPv6();
    const family = ipv6Available ? undefined : 4;
    console.log(
      `[Telegram] Network probe: IPv6 is ${ipv6Available ? 'available' : 'unreachable'}. using IPv${family || 6}`
    );

    this.bot = new Telegraf(this.token, {
      telegram: {
        agent: new Agent({ keepAlive: true, family })
      }
    });

    console.log(`[Telegram] Initializing with allowed users: ${this.allowedUserIds.join(', ')}`);

    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id.toString();

      // 白名單檢查
      if (!this.allowedUserIds.includes(userId)) {
        console.warn(
          `[Telegram] Blocked unauthorized access from: ${userId} (${ctx.from.first_name})`
        );
        return;
      }

      if (this.messageHandler) {
        const unifiedMsg: UnifiedMessage = {
          id: ctx.message.message_id.toString(),
          chatId: ctx.chat.id.toString(),
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
      const chunks = this.splitMessage(text);
      console.log(`[Telegram] Sending message chat=${chatId} chunks=${chunks.length}`);
      for (let i = 0; i < chunks.length; i += 1) {
        await this.sendChunk(chatId, chunks[i]!, i, chunks.length);
      }
    } catch (error) {
      console.error(`[Telegram] Failed to send message to ${chatId}:`, error);
    }
  }

  async sendFile(chatId: string, filePath: string, caption?: string): Promise<void> {
    try {
      const stream = fs.createReadStream(filePath);
      const label = `sendDocument chat=${chatId} file=${filePath}`;
      await this.callTelegram(label, () =>
        this.bot.telegram.sendDocument(
          chatId,
          { source: stream, filename: filePath.split('/').pop() || 'document' },
          caption ? { caption } : undefined
        )
      );
    } catch (error) {
      console.error(`[Telegram] Failed to send file ${filePath} to ${chatId}:`, error);
    }
  }

  async sendPlaceholder(chatId: string, text: string): Promise<string> {
    try {
      const msg = await this.callTelegram(`sendPlaceholder chat=${chatId}`, () =>
        this.bot.telegram.sendMessage(chatId, text)
      );
      return msg.message_id.toString();
    } catch (error) {
      console.error(`[Telegram] Failed to send placeholder to ${chatId}:`, error);
      return '';
    }
  }

  async editMessage(chatId: string, messageId: string, newText: string): Promise<void> {
    try {
      const chunks = this.splitMessage(newText);
      const firstChunk = chunks[0] || '';

      // 1. Edit the original message (placeholder) with the first chunk
      await this.callTelegram(`editMessage chat=${chatId} message=${messageId}`, () =>
        this.bot.telegram.editMessageText(chatId, parseInt(messageId, 10), undefined, firstChunk)
      );

      // 2. Send remaining chunks as new messages
      if (chunks.length > 1) {
        for (let i = 1; i < chunks.length; i++) {
          await this.sendChunk(chatId, chunks[i]!, i, chunks.length);
        }
      }
    } catch (error) {
      console.error(`[Telegram] Failed to edit message ${messageId}:`, error);
      // Fallback: try sending as new message(s) if edit fails
      await this.sendMessage(chatId, newText);
    }
  }
}
