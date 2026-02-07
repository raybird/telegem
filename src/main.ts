import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { TelegramConnector } from './connectors/telegram.js';
import { CommandRouter } from './core/command-router.js';
import { DynamicAIAgent } from './core/agent.js';
import { MemoryManager } from './core/memory.js';
import { Scheduler } from './core/scheduler.js';
import type { UnifiedMessage } from './types/index.js';

// 載入環境變數
dotenv.config();

/**
 * 判斷是否需要生成摘要
 * 簡化的觸發條件：字元長度 + 程式碼區塊 + 行數
 */
function shouldSummarize(content: string): boolean {
  // 條件 1: 超過 200 字元
  if (content.length > 200) return true;

  // 條件 2: 包含程式碼區塊或工具輸出
  if (content.includes('```') || content.includes('tool_result')) return true;

  // 條件 3: 超過 6 行
  if ((content.match(/\n/g) || []).length >= 6) return true;

  return false;
}

type RuntimeIssue = {
  timestamp: number;
  scope: string;
  message: string;
};

const RECENT_ISSUE_LIMIT = 20;
const recentIssues: RuntimeIssue[] = [];

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function recordRuntimeIssue(scope: string, error: unknown): void {
  recentIssues.push({
    timestamp: Date.now(),
    scope,
    message: toErrorMessage(error)
  });
  if (recentIssues.length > RECENT_ISSUE_LIMIT) {
    recentIssues.splice(0, recentIssues.length - RECENT_ISSUE_LIMIT);
  }
}

function loadProviderStatus(): { provider: string; model: string; timezone: string } {
  try {
    const configPath = path.resolve(process.cwd(), 'ai-config.yaml');
    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = yaml.load(content) as Record<string, unknown> | undefined;

    const provider = typeof parsed?.provider === 'string' ? parsed.provider : 'gemini';
    const model = typeof parsed?.model === 'string' ? parsed.model : 'default';
    const timezone =
      typeof parsed?.timezone === 'string' ? parsed.timezone : process.env.TZ || 'Asia/Taipei';
    return { provider, model, timezone };
  } catch {
    return {
      provider: 'gemini',
      model: 'default',
      timezone: process.env.TZ || 'Asia/Taipei'
    };
  }
}

function resolveSchedulerHealthPath(): string {
  const explicitPath = process.env.DB_PATH?.trim();
  if (explicitPath) {
    return path.resolve(path.dirname(explicitPath), 'scheduler-health.json');
  }

  const dbDir = process.env.DB_DIR?.trim();
  if (dbDir) {
    return path.resolve(dbDir, 'scheduler-health.json');
  }

  return path.resolve(process.cwd(), 'scheduler-health.json');
}

function writeSchedulerHealth(trigger: string, memory: MemoryManager): void {
  try {
    const healthPath = resolveSchedulerHealthPath();
    const payload = {
      updatedAt: Date.now(),
      lastReloadAt: Date.now(),
      lastLoadedScheduleCount: memory.getActiveSchedules().length,
      trigger,
      pid: process.pid
    };

    fs.mkdirSync(path.dirname(healthPath), { recursive: true });
    fs.writeFileSync(healthPath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (error) {
    console.warn('[System] Failed to write scheduler health marker:', error);
  }
}

function resolveContextDir(): string {
  const projectDir = process.env.GEMINI_PROJECT_DIR?.trim() || process.cwd();
  return path.resolve(projectDir, 'workspace', 'context');
}

function writeContextSnapshots(memory: MemoryManager): void {
  try {
    const contextDir = resolveContextDir();
    fs.mkdirSync(contextDir, { recursive: true });

    const now = new Date();
    const provider = loadProviderStatus();
    const runtimeStatus = [
      '# Runtime Status',
      '',
      `- Updated: ${now.toLocaleString('zh-TW')}`,
      `- Node PID: ${process.pid}`,
      `- NODE_ENV: ${process.env.NODE_ENV || 'unknown'}`,
      `- Provider Config File: ai-config.yaml`,
      `- Active Provider: ${provider.provider}`,
      `- Active Model: ${provider.model}`,
      `- Timezone (TZ): ${process.env.TZ || 'Asia/Taipei (default)'}`,
      `- Runner Endpoint: ${process.env.RUNNER_ENDPOINT || '(disabled)'}`,
      `- Scheduler Runner Mode: ${process.env.SCHEDULE_USE_RUNNER || 'false'}`,
      `- Chat Runner Percent: ${process.env.CHAT_USE_RUNNER_PERCENT || '0'}`,
      `- Chat Runner Whitelist: ${process.env.CHAT_USE_RUNNER_ONLY_USERS || '(all users)'}`,
      `- Runner Failure Threshold: ${process.env.RUNNER_FAILURE_THRESHOLD || '3'}`,
      `- Runner Cooldown (ms): ${process.env.RUNNER_COOLDOWN_MS || '60000'}`,
      `- DB_PATH: ${process.env.DB_PATH || '(auto-resolved)'}`,
      `- DB_DIR: ${process.env.DB_DIR || '(not set)'}`,
      `- GEMINI_PROJECT_DIR: ${process.env.GEMINI_PROJECT_DIR || process.cwd()}`
    ].join('\n');

    const providerStatus = [
      '# Provider Status',
      '',
      `- Updated: ${now.toLocaleString('zh-TW')}`,
      `- Provider: ${provider.provider}`,
      `- Model: ${provider.model}`,
      `- Timezone: ${provider.timezone}`
    ].join('\n');

    const schedules = memory.getActiveSchedules();
    const schedulerLines = schedules.map((schedule) => {
      return `- #${schedule.id} | ${schedule.name} | ${schedule.cron} | user=${schedule.user_id}`;
    });
    const schedulerStatus = [
      '# Scheduler Status',
      '',
      `- Updated: ${now.toLocaleString('zh-TW')}`,
      `- Active Schedules: ${schedules.length}`,
      '',
      '## Active Schedule List',
      ...(schedulerLines.length > 0 ? schedulerLines : ['- (none)'])
    ].join('\n');

    const systemArchitecture = [
      '# System Architecture Snapshot',
      '',
      '- Input channel: Telegram -> CommandRouter -> Scheduler/Agent',
      '- Scheduler source of truth: SQLite schedules table',
      '- Agent runtime: Gemini/Opencode CLI executed from workspace/',
      '- Long-term memory hook: workspace/.gemini/hooks/retrieve-memory.sh',
      '- Main runtime service: TeleNexus orchestrator'
    ].join('\n');

    const operationsPolicy = [
      '# Operations Policy',
      '',
      '- Read system context from files in workspace/context/',
      '- Do not modify application source code unless explicitly requested by user',
      '- Prefer scheduler commands via Telegram command router',
      '- In Docker, use `docker compose exec telenexus ...` for maintenance commands',
      '- Avoid using one-off `docker compose run` for scheduler modifications'
    ].join('\n');

    const recentIssueLines = recentIssues
      .slice(-10)
      .map(
        (issue) =>
          `- [${new Date(issue.timestamp).toLocaleString('zh-TW')}] (${issue.scope}) ${issue.message}`
      );
    const errorSummary = [
      '# Error Summary',
      '',
      `- Updated: ${now.toLocaleString('zh-TW')}`,
      '',
      '## Recent Runtime Issues',
      ...(recentIssueLines.length > 0 ? recentIssueLines : ['- (none)'])
    ].join('\n');

    fs.writeFileSync(path.join(contextDir, 'runtime-status.md'), runtimeStatus, 'utf8');
    fs.writeFileSync(path.join(contextDir, 'provider-status.md'), providerStatus, 'utf8');
    fs.writeFileSync(path.join(contextDir, 'scheduler-status.md'), schedulerStatus, 'utf8');
    fs.writeFileSync(path.join(contextDir, 'system-architecture.md'), systemArchitecture, 'utf8');
    fs.writeFileSync(path.join(contextDir, 'operations-policy.md'), operationsPolicy, 'utf8');
    fs.writeFileSync(path.join(contextDir, 'error-summary.md'), errorSummary, 'utf8');
  } catch (error) {
    console.warn('[System] Failed to write context snapshots:', error);
  }
}

function getContextRefreshMs(): number {
  const raw = process.env.CONTEXT_REFRESH_MS?.trim();
  if (!raw) return 60000;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 10000) {
    return 60000;
  }
  return parsed;
}

function getChatRunnerPercent(): number {
  const raw = process.env.CHAT_USE_RUNNER_PERCENT?.trim();
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

function getRunnerFailureThreshold(): number {
  const raw = process.env.RUNNER_FAILURE_THRESHOLD?.trim();
  if (!raw) return 3;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  return parsed;
}

function getRunnerCooldownMs(): number {
  const raw = process.env.RUNNER_COOLDOWN_MS?.trim();
  if (!raw) return 60000;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1000) return 60000;
  return parsed;
}

function getChatRunnerOnlyUsers(defaultUserId?: string): Set<string> {
  const raw = process.env.CHAT_USE_RUNNER_ONLY_USERS?.trim();
  if (!raw) {
    return defaultUserId ? new Set<string>([defaultUserId]) : new Set<string>();
  }
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  );
}

function hashToBucket(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

async function bootstrap() {
  console.log('🚀 Starting TeleNexus (YOLO Agent + Stream UX)...');

  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID;

  if (!TELEGRAM_TOKEN || !ALLOWED_USER_ID) {
    console.error('❌ Missing environment variables.');
    process.exit(1);
  }

  // 初始化元件
  const telegram = new TelegramConnector(TELEGRAM_TOKEN, [ALLOWED_USER_ID]);
  const userAgent = new DynamicAIAgent();
  const runnerEndpoint = process.env.RUNNER_ENDPOINT?.trim();
  const runnerToken = process.env.RUNNER_SHARED_SECRET?.trim();
  const runnerFailureThreshold = getRunnerFailureThreshold();
  const runnerCooldownMs = getRunnerCooldownMs();
  const useRunnerForSchedule =
    process.env.SCHEDULE_USE_RUNNER === 'true' && Boolean(runnerEndpoint);
  const chatRunnerPercent = getChatRunnerPercent();
  const chatRunnerOnlyUsers = getChatRunnerOnlyUsers(ALLOWED_USER_ID);
  const useRunnerForChat = chatRunnerPercent > 0 && Boolean(runnerEndpoint);
  const runnerOptions = runnerEndpoint
    ? {
        runnerEndpoint,
        ...(runnerToken ? { runnerToken } : {}),
        runnerFailureThreshold,
        runnerCooldownMs,
        preferRunner: true,
        fallbackToLocal: true
      }
    : undefined;
  const schedulerAgent = useRunnerForSchedule
    ? new DynamicAIAgent('ai-config.yaml', runnerOptions)
    : userAgent;
  const chatRunnerAgent = useRunnerForChat
    ? new DynamicAIAgent('ai-config.yaml', runnerOptions)
    : userAgent;
  console.log(
    `[System] Scheduler execution mode: ${useRunnerForSchedule ? `runner (${runnerEndpoint})` : 'local'}`
  );
  console.log(
    `[System] Chat runner canary: ${useRunnerForChat ? `${chatRunnerPercent}% via ${runnerEndpoint}` : 'disabled'}`
  );
  if (chatRunnerOnlyUsers.size > 0) {
    console.log(`[System] Chat runner whitelist: ${Array.from(chatRunnerOnlyUsers).join(', ')}`);
  }
  const memory = new MemoryManager();
  const scheduler = new Scheduler(memory, schedulerAgent, telegram);
  const commandRouter = new CommandRouter();
  let contextRefreshTimer: NodeJS.Timeout | null = null;

  const stopContextRefresh = () => {
    if (contextRefreshTimer) {
      clearInterval(contextRefreshTimer);
      contextRefreshTimer = null;
    }
  };

  // 註冊優雅關閉處理器
  process.on('SIGINT', () => {
    console.log('\n[System] Shutting down gracefully...');
    stopContextRefresh();
    scheduler.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[System] Shutting down gracefully...');
    stopContextRefresh();
    scheduler.shutdown();
    process.exit(0);
  });

  process.on('SIGUSR1', async () => {
    try {
      console.log('\n[System] Received SIGUSR1, reloading schedules...');
      await scheduler.reload();
      writeSchedulerHealth('signal:SIGUSR1', memory);
      writeContextSnapshots(memory);
    } catch (error) {
      console.error('[System] Failed handling SIGUSR1 reload:', error);
      recordRuntimeIssue('signal:SIGUSR1', error);
      writeContextSnapshots(memory);
    }
  });

  // 設定訊息處理邏輯
  telegram.onMessage(async (msg: UnifiedMessage) => {
    console.log(`📩 [${msg.sender.platform}] ${msg.sender.name}: ${msg.content}`);
    const userId = msg.sender.id;

    // 重置沉默計時器 (30 分鐘無訊息後觸發追蹤提醒)
    scheduler.resetSilenceTimer(userId);
    writeContextSnapshots(memory);

    const commandHandled = await commandRouter.handleMessage(msg, {
      connector: telegram,
      memory,
      scheduler
    });
    if (commandHandled) {
      return;
    }

    const isPassthroughCommand = commandRouter.isPassthroughCommand(msg.content.trim());

    const isWhitelisted = chatRunnerOnlyUsers.size === 0 || chatRunnerOnlyUsers.has(msg.sender.id);
    const bucket = hashToBucket(`${msg.sender.id}:${msg.id}`);
    const useRunnerThisMessage = useRunnerForChat && isWhitelisted && bucket < chatRunnerPercent;
    const activeAgent = useRunnerThisMessage ? chatRunnerAgent : userAgent;
    console.log(
      `[System] Message execution mode: ${useRunnerThisMessage ? 'runner' : 'local'} (bucket=${bucket}, canary=${chatRunnerPercent}%, whitelist=${isWhitelisted})`
    );

    // UX: 先發送 "Thinking..." 佔位訊息，並啟動輪播
    let placeholderMsgId = '';
    let thinkingInterval: NodeJS.Timeout | null = null;

    const thinkingMessages = [
      '🤔 思考中...',
      '🧠 正在理解問題...',
      '🔍 搜尋相關資訊...',
      '⚡ 處理中...',
      '💭 組織回答...',
      '🎯 分析脈絡...'
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
            console.warn('Failed to update thinking message', e);
          }
        }, 3000);
      }
    } catch (e) {
      console.warn('Failed to send placeholder', e);
    }

    try {
      // 1. 存入使用者訊息 (依條件自動摘要)
      let userSummary: string | undefined;

      if (shouldSummarize(msg.content)) {
        console.log(`📝 [Memory] User input meets summary criteria, generating summary...`);
        userSummary = await activeAgent.summarize(msg.content);
      }

      memory.addMessage(userId, 'user', msg.content, userSummary);

      // 2. 準備 Context
      const historyContext = memory.getHistoryContext(userId);

      // 3. 組合 Prompt
      const fullPrompt = `
System: 你是 TeleNexus，一個具備強大工具執行能力的本地 AI 助理。
當使用者要求你搜尋網路、查看檔案或執行指令時，請善用你手邊的工具（如 google_search, read_file 等）。
現在已經開啟了 YOLO 模式，你的所有工具調用都會被自動允許。
請用繁體中文回應。

【記憶管理】
你只能看到最近 15 則對話的摘要或原文（最新 5 則為完整原文）。如果你需要回想更早之前的資訊，請執行以下指令：
node dist/tools/memory-cli.js search "關鍵字"
這會從資料庫搜尋相關的歷史對話並顯示給你。

【知識管理 - 重要】
你有 MCP Memory 工具可以儲存長期知識與關係：
- 當對話包含重要資訊（如：使用者偏好、專案細節、重要決策）時，請主動使用 create_entities 儲存
- 當發現實體間的關係時，使用 create_relations 建立連結
- 需要回想相關知識時，使用 search_entities 搜尋
- 在對話結束前，如果有值得記住的內容，請務必儲存到 Memory

【工作目錄限制 - 重要】
- 你的當前工作目錄是 workspace/
- 優先讀取 workspace/context/ 內的系統快照檔案理解運行狀態
- 若需產生暫存資料，請放在 workspace/temp/
- 不要主動修改應用程式原始碼或部署設定，除非使用者明確要求

Conversation History:
${historyContext}

AI Response:
`.trim();

      const promptForAgent = isPassthroughCommand ? msg.content.trim() : fullPrompt;

      if (isPassthroughCommand) {
        console.log(`📤 [System] Passthrough command -> AI: ${promptForAgent}`);
      } else {
        console.log(`📤 [System] Sending prompt to AI (length: ${fullPrompt.length} chars)`);
      }

      // 4. 呼叫 AI Agent (DynamicAgent 會根據 ai-config.yaml 選擇 provider)
      const response = await activeAgent.chat(promptForAgent);

      console.log(`📥 [AI] Reply length: ${response.length}`);

      // 5. 存入 AI 回應 (依條件自動摘要)
      if (response && !response.startsWith('Error')) {
        let responseSummary: string | undefined;

        if (shouldSummarize(response)) {
          console.log(`📝 [Memory] AI response meets summary criteria, generating summary...`);
          responseSummary = await activeAgent.summarize(response);
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
      recordRuntimeIssue('message-processing', error);
      writeContextSnapshots(memory);
      const errorMsg = 'Sorry, I encountered an error while exercising my powers.';

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
  writeSchedulerHealth('startup:init', memory);
  writeContextSnapshots(memory);

  const contextRefreshMs = getContextRefreshMs();
  contextRefreshTimer = setInterval(() => {
    writeContextSnapshots(memory);
  }, contextRefreshMs);
  contextRefreshTimer.unref();
  console.log(`[System] Context snapshots auto-refresh every ${contextRefreshMs}ms`);
}

bootstrap().catch((err) => {
  console.error('❌ Fatal Error:', err);
});

// Trigger restart to load new schedules
