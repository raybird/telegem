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
export declare class CommandRouter {
    private commands;
    constructor();
    registerCommand(command: CommandDefinition): void;
    handleMessage(msg: UnifiedMessage, deps: {
        connector: Connector;
        memory: MemoryManager;
        scheduler: Scheduler;
    }): Promise<boolean>;
    private registerDefaultCommands;
}
export {};
//# sourceMappingURL=command-router.d.ts.map