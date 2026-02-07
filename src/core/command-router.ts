import type { Connector, UnifiedMessage } from '../types/index.js';
import type { MemoryManager } from './memory.js';
import type { Scheduler } from './scheduler.js';
import fs from 'fs';
import yaml from 'js-yaml';

type CommandContext = {
  msg: UnifiedMessage;
  userId: string;
  content: string;
  connector: Connector;
  memory: MemoryManager;
  scheduler: Scheduler;
};

type CommandDefinition = {
  name: string;
  match: (content: string) => boolean;
  execute: (context: CommandContext) => Promise<void>;
};

export class CommandRouter {
  private commands: CommandDefinition[] = [];
  private defaultPassthroughCommandWhitelist: Set<string> = new Set([
    '/compress',
    '/compact',
    '/clear'
  ]);

  constructor() {
    this.registerDefaultCommands();
  }

  registerCommand(command: CommandDefinition): void {
    this.commands.push(command);
  }

  async handleMessage(
    msg: UnifiedMessage,
    deps: { connector: Connector; memory: MemoryManager; scheduler: Scheduler }
  ): Promise<boolean> {
    // 清理訊息內容，移除可能導致 shell 錯誤的特殊字元
    const content = msg.content.trim().replace(/[`'"]/g, '');

    // 檢查是否為指令（以 / 開頭）
    const isCommand = content.startsWith('/');

    for (const command of this.commands) {
      if (command.match(content)) {
        await command.execute({
          msg,
          userId: msg.sender.id,
          content,
          connector: deps.connector,
          memory: deps.memory,
          scheduler: deps.scheduler
        });
        return true;
      }
    }

    // 白名單指令：保留給底層 CLI/Agent 處理，不在 CommandRouter 擋下
    if (isCommand && this.isPassthroughCommand(content)) {
      return false;
    }

    // 如果是指令但沒有匹配到任何已註冊的指令，回傳錯誤訊息
    if (isCommand) {
      await deps.connector.sendMessage(
        msg.sender.id,
        '❌ 未知指令。請使用 /start 查看可用指令列表。'
      );
      return true;
    }

    return false;
  }

  isPassthroughCommand(content: string): boolean {
    const token = content.split(/\s+/)[0] || '';
    const baseCommand = token.split('@')[0] || '';
    const whitelist = this.loadPassthroughCommandWhitelist();
    return whitelist.has(baseCommand);
  }

  private loadPassthroughCommandWhitelist(): Set<string> {
    try {
      if (!fs.existsSync('ai-config.yaml')) {
        return this.defaultPassthroughCommandWhitelist;
      }

      const fileContent = fs.readFileSync('ai-config.yaml', 'utf8');
      const config = yaml.load(fileContent) as
        | {
            passthrough_commands?: unknown;
          }
        | undefined;
      const commands = config?.passthrough_commands;

      if (!Array.isArray(commands) || commands.length === 0) {
        return this.defaultPassthroughCommandWhitelist;
      }

      const normalized = commands
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.startsWith('/'));

      return normalized.length > 0 ? new Set(normalized) : this.defaultPassthroughCommandWhitelist;
    } catch {
      return this.defaultPassthroughCommandWhitelist;
    }
  }

  private registerDefaultCommands(): void {
    this.registerCommand({
      name: 'start',
      match: (content) => content === '/start',
      execute: async ({ userId, connector }) => {
        const helpMessage = `
🤖 **歡迎使用 TeleNexus!**

我是您的 AI 助理，隨時準備協助您。

🛠 **基本指令**
- \`/reset\`: 清除 AI 短期記憶 (Context Window)
- \`/start\`: 顯示此說明訊息

📅 **排程管理功能**
目前的系統內建了強大的排程系統，您可以設定定時任務讓 AI 主動執行。

**1. 新增排程**
格式：\`/add_schedule 名稱 | Cron表達式 | 提示詞\`
範例：
\`\`\`
/add_schedule 早安問候 | 0 9 * * * | 跟我說早安並報告天氣
\`\`\`

**2. 查看排程**
指令：\`/list_schedules\`

**3. 刪除排程**
指令：\`/remove_schedule [ID]\`
範例：\`/remove_schedule 1\`

若有任何問題，直接跟我說即可！
`.trim();
        await connector.sendMessage(userId, helpMessage);
      }
    });

    this.registerCommand({
      name: 'reset',
      match: (content) => content === '/reset',
      execute: async ({ userId, connector, memory }) => {
        memory.clear(userId);
        await connector.sendMessage(userId, '🧹 記憶已清除。');
      }
    });

    this.registerCommand({
      name: 'list_schedules',
      match: (content) => content === '/list_schedules',
      execute: async ({ userId, connector, scheduler }) => {
        const schedules = scheduler.listSchedules(userId);
        if (schedules.length === 0) {
          await connector.sendMessage(userId, '📋 目前沒有任何排程。');
          return;
        }

        const list = schedules
          .map(
            (schedule, idx) =>
              `${idx + 1}. [ID: ${schedule.id}] ${schedule.name}\n   ⏰ Cron: ${schedule.cron}\n   📝 Prompt: ${schedule.prompt}\n   ${schedule.is_active ? '✅ 啟用中' : '❌ 已停用'}`
          )
          .join('\n\n');
        await connector.sendMessage(userId, `📋 您的排程列表：\n\n${list}`);
      }
    });

    this.registerCommand({
      name: 'remove_schedule',
      match: (content) => content.startsWith('/remove_schedule '),
      execute: async ({ userId, connector, scheduler, content }) => {
        const parts = content.split(' ');
        if (parts.length !== 2) {
          await connector.sendMessage(userId, '❌ 格式錯誤。使用範例：/remove_schedule 1');
          return;
        }
        const id = Number.parseInt(parts[1]!, 10);
        if (Number.isNaN(id)) {
          await connector.sendMessage(userId, '❌ ID 必須是數字。');
          return;
        }
        try {
          scheduler.removeSchedule(id);
          await connector.sendMessage(userId, `✅ 已刪除排程 #${id}`);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          await connector.sendMessage(userId, `❌ 刪除失敗：${errMsg}`);
        }
      }
    });

    this.registerCommand({
      name: 'add_schedule',
      match: (content) => content.startsWith('/add_schedule '),
      execute: async ({ userId, connector, scheduler, content }) => {
        const raw = content.replace('/add_schedule ', '').trim();
        const parts = raw.split('|').map((part) => part.trim());
        if (parts.length !== 3) {
          await connector.sendMessage(
            userId,
            '❌ 格式錯誤。使用範例：\n/add_schedule 早安問候|0 9 * * *|早安！今天天氣如何？'
          );
          return;
        }
        const [name, cron, prompt] = parts;
        try {
          const id = scheduler.addSchedule(userId, name!, cron!, prompt!);
          await connector.sendMessage(userId, `✅ 成功新增排程 #${id}：${name}`);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          await connector.sendMessage(userId, `❌ 新增失敗：${errMsg}`);
        }
      }
    });
    this.registerCommand({
      name: 'reflect',
      match: (content) => content === '/reflect',
      execute: async ({ userId, connector, scheduler }) => {
        const msgId = await connector.sendPlaceholder(userId, '🔍 分析中...');
        try {
          // 手動觸發追蹤，並傳入 msgId 以便編輯回應
          await scheduler.triggerReflection(userId, 'manual', msgId);
        } catch (error) {
          console.error('Reflection error:', error);
          if (msgId) {
            await connector.editMessage(userId, msgId, '❌ 追蹤分析失敗，請檢查系統日誌。');
          } else {
            await connector.sendMessage(userId, '❌ 追蹤分析失敗，請檢查系統日誌。');
          }
        }
      }
    });
  }
}
