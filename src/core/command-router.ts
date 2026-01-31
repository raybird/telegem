import type { Connector, UnifiedMessage } from '../types/index.js';
import type { MemoryManager } from './memory.js';
import type { Scheduler } from './scheduler.js';

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
    const content = msg.content.trim();
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
    return false;
  }

  private registerDefaultCommands(): void {
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
  }
}
