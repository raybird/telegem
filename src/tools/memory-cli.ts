#!/usr/bin/env node
import { Command } from 'commander';
import { MemoryManager } from '../core/memory.js';

const program = new Command();

program
    .name('memory-cli')
    .description('CLI tool for managing Moltbot AI memory')
    .version('2.2.0');

// Helper to get User ID
function getUserId(options: { user?: string }): string {
    const userId = options.user || process.env.ALLOWED_USER_ID;
    if (!userId) {
        console.error('❌ Error: User ID is required. Set ALLOWED_USER_ID or use --user flag.');
        process.exit(1);
    }
    return userId;
}

// 1. Search Command
program
    .command('search')
    .description('Search chat history by keyword')
    .argument('<query>', 'Keyword to search for')
    .option('-u, --user <userId>', 'User ID')
    .option('-l, --limit <number>', 'Max results', '5')
    .action((query, options) => {
        try {
            const userId = getUserId(options);
            const memory = new MemoryManager();
            const limit = parseInt(options.limit, 10);

            console.log(`🔍 Searching memory for: "${query}"...`);
            const results = memory.search(userId, query, limit);

            if (results.length === 0) {
                console.log('📭 No matching records found.');
                return;
            }

            console.log(`✅ Found ${results.length} results:\n`);
            results.forEach((msg, idx) => {
                const date = new Date(msg.timestamp).toLocaleString('zh-TW');
                const role = msg.role === 'user' ? 'User' : 'AI';
                const preview = msg.content.length > 150
                    ? msg.content.substring(0, 150) + '...'
                    : msg.content;

                console.log(`${idx + 1}. [${date}] ${role}: ${preview}`);
                console.log('---');
            });

        } catch (error: any) {
            console.error('❌ Search failed:', error.message);
            process.exit(1);
        }
    });

// 2. Stats Command
program
    .command('stats')
    .description('Show memory usage statistics')
    .option('-u, --user <userId>', 'User ID')
    .action((options) => {
        try {
            const userId = getUserId(options);
            const memory = new MemoryManager();
            const stats = memory.getStats(userId);

            console.log('📊 Memory Statistics:');
            console.log(`   User ID: ${userId}`);
            console.log(`   Total Messages: ${stats.totalMessages}`);
            console.log(`   Last Active: ${stats.lastActive ? new Date(stats.lastActive).toLocaleString('zh-TW') : 'Never'}`);

        } catch (error: any) {
            console.error('❌ Failed to get stats:', error.message);
            process.exit(1);
        }
    });

// 3. Forget Command
program
    .command('forget')
    .description('Forget the most recent messages')
    .argument('<count>', 'Number of messages to forget (e.g. 2)')
    .option('-u, --user <userId>', 'User ID')
    .action((countStr, options) => {
        try {
            const userId = getUserId(options);
            const count = parseInt(countStr, 10);

            if (isNaN(count) || count <= 0) {
                console.error('❌ Invalid count number.');
                process.exit(1);
            }

            const memory = new MemoryManager();
            const deleted = memory.deleteRecentMessages(userId, count);

            console.log(`🗑️  Forgot ${deleted} recent message(s).`);

        } catch (error: any) {
            console.error('❌ Failed to forget messages:', error.message);
            process.exit(1);
        }
    });

// 4. Clear Command
program
    .command('clear')
    .description('Clear ALL memory for the user (Irreversible)')
    .option('-u, --user <userId>', 'User ID')
    .option('-f, --force', 'Skip confirmation')
    .action(async (options) => {
        try {
            const userId = getUserId(options);

            if (!options.force) {
                console.warn('⚠️  Warning: This will delete ALL chat history for this user.');
                console.warn('   Use --force to confirm.');
                return;
            }

            const memory = new MemoryManager();
            memory.clear(userId);

            console.log(`💥 All memory cleared for user: ${userId}`);

        } catch (error: any) {
            console.error('❌ Failed to clear memory:', error.message);
            process.exit(1);
        }
    });

program.parse();
