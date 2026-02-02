#!/usr/bin/env node
import { Command } from 'commander';
import { MemoryManager } from '../core/memory.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const program = new Command();

program
    .name('scheduler-cli')
    .description('CLI tool for managing TeleNexus schedules')
    .version('1.0.0');

/**
 * 尋找主程序的 PID 並發送 SIGUSR1 信號
 */
async function notifyMainProcess(): Promise<void> {
    try {
        // 尋找 node dist/main.js 或 tsx src/main.ts 的 PID
        const { stdout } = await execAsync('pgrep -f "dist/main.js|tsx.*src/main.ts"');
        const pids = stdout.trim().split('\n').filter(pid => pid);

        if (pids.length === 0) {
            console.log('⚠️  Warning: Main process not found. Schedules will be loaded on next restart.');
            return;
        }

        // 發送 SIGUSR1 給所有匹配的程序
        for (const pid of pids) {
            await execAsync(`kill -SIGUSR1 ${pid}`);
            console.log(`✅ Sent reload signal to process ${pid}`);
        }
    } catch (error) {
        console.log('⚠️  Warning: Could not notify main process. Schedules will be loaded on next restart.');
    }
}

program
    .command('add')
    .description('Add a new schedule')
    .argument('<name>', 'Schedule name')
    .argument('<cron>', 'Cron expression (e.g., "0 9 * * *")')
    .argument('<prompt>', 'Prompt to execute')
    .option('-u, --user <userId>', 'User ID', process.env.ALLOWED_USER_ID || '')
    .action(async (name: string, cron: string, prompt: string, options: { user: string }) => {
        if (!options.user) {
            console.error('❌ Error: User ID is required. Set ALLOWED_USER_ID or use --user flag.');
            process.exit(1);
        }

        try {
            const memory = new MemoryManager();
            const id = memory.addSchedule(options.user, name, cron, prompt);
            console.log(`✅ Schedule added successfully!`);
            console.log(`   ID: ${id}`);
            console.log(`   Name: ${name}`);
            console.log(`   Cron: ${cron}`);
            console.log(`   Prompt: ${prompt}`);

            await notifyMainProcess();
        } catch (error) {
            console.error('❌ Error adding schedule:', error);
            process.exit(1);
        }
    });

program
    .command('remove')
    .description('Remove a schedule by ID')
    .argument('<id>', 'Schedule ID to remove')
    .action(async (id: string) => {
        try {
            const memory = new MemoryManager();
            const scheduleId = parseInt(id, 10);

            if (isNaN(scheduleId)) {
                console.error('❌ Error: Invalid schedule ID. Must be a number.');
                process.exit(1);
            }

            memory.removeSchedule(scheduleId);
            console.log(`✅ Schedule #${scheduleId} removed successfully!`);

            await notifyMainProcess();
        } catch (error) {
            console.error('❌ Error removing schedule:', error);
            process.exit(1);
        }
    });

program
    .command('list')
    .description('List all schedules')
    .option('-u, --user <userId>', 'Filter by user ID', process.env.ALLOWED_USER_ID || '')
    .action((options: { user: string }) => {
        try {
            const memory = new MemoryManager();
            const schedules = options.user
                ? memory.getUserSchedules(options.user)
                : memory.getActiveSchedules();

            if (schedules.length === 0) {
                console.log('📋 No schedules found.');
                return;
            }

            console.log(`📋 Found ${schedules.length} schedule(s):\n`);

            for (const schedule of schedules) {
                const status = schedule.is_active ? '✅ Active' : '❌ Inactive';
                console.log(`ID: ${schedule.id}`);
                console.log(`Name: ${schedule.name}`);
                console.log(`Cron: ${schedule.cron}`);
                console.log(`Prompt: ${schedule.prompt}`);
                console.log(`User: ${schedule.user_id}`);
                console.log(`Status: ${status}`);
                console.log(`Created: ${new Date(schedule.created_at).toLocaleString('zh-TW')}`);
                console.log('---');
            }
        } catch (error) {
            console.error('❌ Error listing schedules:', error);
            process.exit(1);
        }
    });

program.parse();
