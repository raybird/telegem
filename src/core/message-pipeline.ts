import type { Connector, UnifiedMessage } from '../types/index.js';
import type { AIAgent } from './agent.js';
import type { CommandRouter } from './command-router.js';
import type { MemoriaSyncTurn } from './memoria-sync.js';
import type { MemoryManager } from './memory.js';
import type { Scheduler } from './scheduler.js';

type MessagePipelineOptions = {
  connector: Connector;
  resolveConnector?: (msg: UnifiedMessage) => Connector;
  commandRouter: CommandRouter;
  memory: MemoryManager;
  scheduler: Scheduler;
  userAgent: AIAgent;
  chatRunnerAgent: AIAgent;
  useRunnerForChat: boolean;
  chatRunnerPercent: number;
  chatRunnerOnlyUsers: Set<string>;
  shouldSummarize: (content: string) => boolean;
  buildPrompt: (userMessage: string) => string;
  enqueueMemoriaSync?: (turn: MemoriaSyncTurn) => void;
  recordRuntimeIssue: (scope: string, error: unknown) => void;
  writeContextSnapshots: () => void;
};

function hashToBucket(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function createMessagePipeline(options: MessagePipelineOptions) {
  const pendingNewSessionUsers = new Set<string>();
  const thinkingMessages = [
    '🤔 思考中...',
    '🧠 正在理解問題...',
    '🔍 搜尋相關資訊...',
    '⚡ 處理中...',
    '💭 組織回答...',
    '🎯 分析脈絡...'
  ];

  return async (msg: UnifiedMessage): Promise<void> => {
    const connector = options.resolveConnector?.(msg) || options.connector;
    console.log(`📩 [${msg.sender.platform}] ${msg.sender.name}: ${msg.content}`);
    const userId = msg.sender.id;
    const targetChatId = msg.chatId || userId;

    options.scheduler.resetSilenceTimer(userId);
    options.writeContextSnapshots();

    const commandHandled = await options.commandRouter.handleMessage(msg, {
      connector,
      memory: options.memory,
      scheduler: options.scheduler,
      requestNewSession: (targetUserId: string) => {
        pendingNewSessionUsers.add(targetUserId);
      }
    });
    if (commandHandled) {
      return;
    }

    const isPassthroughCommand = options.commandRouter.isPassthroughCommand(msg.content.trim());
    const forceNewSession = pendingNewSessionUsers.has(userId);
    if (forceNewSession) {
      pendingNewSessionUsers.delete(userId);
      console.log('[System] Applying one-time new session mode for this message.');
    }

    const isWhitelisted =
      options.chatRunnerOnlyUsers.size === 0 || options.chatRunnerOnlyUsers.has(msg.sender.id);
    const bucket = hashToBucket(`${msg.sender.id}:${msg.id}`);
    const useRunnerThisMessage =
      options.useRunnerForChat && isWhitelisted && bucket < options.chatRunnerPercent;
    const activeAgent = useRunnerThisMessage ? options.chatRunnerAgent : options.userAgent;
    console.log(
      `[System] Message execution mode: ${useRunnerThisMessage ? 'runner' : 'local'} (bucket=${bucket}, canary=${options.chatRunnerPercent}%, whitelist=${isWhitelisted})`
    );

    let placeholderMsgId = '';
    let thinkingInterval: NodeJS.Timeout | null = null;
    let messageIndex = 0;

    try {
      placeholderMsgId = await connector.sendPlaceholder(targetChatId, thinkingMessages[0]!);

      if (placeholderMsgId) {
        thinkingInterval = setInterval(async () => {
          messageIndex = (messageIndex + 1) % thinkingMessages.length;
          try {
            await connector.editMessage(
              targetChatId,
              placeholderMsgId,
              thinkingMessages[messageIndex]!
            );
          } catch (error) {
            console.warn('Failed to update thinking message', error);
          }
        }, 3000);
      }
    } catch (error) {
      console.warn('Failed to send placeholder', error);
    }

    try {
      let userSummary: string | undefined;

      if (!isPassthroughCommand && options.shouldSummarize(msg.content)) {
        console.log('📝 [Memory] User input meets summary criteria, generating summary...');
        userSummary = await activeAgent.summarize(msg.content);
      }

      options.memory.addMessage(userId, 'user', msg.content, userSummary);

      let promptForAgent = msg.content.trim();
      if (!isPassthroughCommand) {
        promptForAgent = options.buildPrompt(msg.content);
      }

      if (isPassthroughCommand) {
        console.log(`📤 [System] Passthrough command -> CLI: ${promptForAgent}`);
      } else {
        console.log(`📤 [System] Sending prompt to AI (length: ${promptForAgent.length} chars)`);
      }

      const response = await activeAgent.chat(promptForAgent, {
        isPassthroughCommand,
        forceNewSession
      });

      console.log(`📥 [AI] Reply length: ${response.length}`);

      if (response && !response.startsWith('Error')) {
        let responseSummary: string | undefined;

        if (!isPassthroughCommand && options.shouldSummarize(response)) {
          console.log('📝 [Memory] AI response meets summary criteria, generating summary...');
          responseSummary = await activeAgent.summarize(response);
        }

        options.memory.addMessage(userId, 'model', response, responseSummary);

        options.enqueueMemoriaSync?.({
          userId,
          userMessage: msg.content,
          modelMessage: response,
          platform: msg.sender.platform,
          isPassthroughCommand,
          forceNewSession
        });
      }

      if (thinkingInterval) {
        clearInterval(thinkingInterval);
      }

      if (placeholderMsgId) {
        await connector.editMessage(targetChatId, placeholderMsgId, response);
      } else {
        await connector.sendMessage(targetChatId, response);
      }
    } catch (error) {
      console.error('❌ Error processing message:', error);
      options.recordRuntimeIssue('message-processing', error);
      options.writeContextSnapshots();
      const errorMsg = 'Sorry, I encountered an error while exercising my powers.';

      if (thinkingInterval) {
        clearInterval(thinkingInterval);
      }

      if (placeholderMsgId) {
        await connector.editMessage(targetChatId, placeholderMsgId, errorMsg);
      } else {
        await connector.sendMessage(targetChatId, errorMsg);
      }
    }
  };
}
