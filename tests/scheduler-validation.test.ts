import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MemoryManager } from '../src/core/memory.js';
import { Scheduler } from '../src/core/scheduler.js';
import type { AIAgent } from '../src/core/agent.js';
import type { Connector } from '../src/types/index.js';

function withTempDb<T>(fn: () => T): T {
  const prevDbPath = process.env.DB_PATH;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telenexus-scheduler-test-'));
  process.env.DB_PATH = path.join(tempDir, 'test.db');

  try {
    return fn();
  } finally {
    if (prevDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = prevDbPath;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function createAgentStub(): AIAgent {
  return {
    async chat(): Promise<string> {
      return 'ok';
    },
    async summarize(text: string): Promise<string> {
      return text;
    }
  };
}

function createConnectorStub(): Connector {
  return {
    name: 'test',
    async initialize(): Promise<void> {
      return;
    },
    async sendMessage(): Promise<void> {
      return;
    },
    async sendPlaceholder(): Promise<string> {
      return 'placeholder-id';
    },
    async editMessage(): Promise<void> {
      return;
    },
    onMessage(): void {
      return;
    }
  };
}

test('Scheduler validates cron input and supports schedule update', () => {
  withTempDb(() => {
    const memory = new MemoryManager();
    const scheduler = new Scheduler(memory, createAgentStub(), createConnectorStub());

    assert.throws(() => {
      scheduler.addSchedule('user-a', 'invalid', '*/5 * *', 'test prompt');
    }, /5 fields/);

    const scheduleId = scheduler.addSchedule('user-a', 'daily-report', '0 9 * * 1-5', 'old prompt');

    assert.throws(() => {
      scheduler.updateSchedule('user-a', scheduleId, 'daily-report', 'invalid cron', 'new prompt');
    }, /Invalid cron expression|5 fields/);

    const updated = scheduler.updateSchedule(
      'user-a',
      scheduleId,
      'global-market-report',
      '30 8 * * 1-5',
      'new prompt'
    );

    assert.equal(updated.name, 'global-market-report');
    assert.equal(updated.cron, '30 8 * * 1-5');
    assert.equal(updated.prompt, 'new prompt');

    assert.throws(() => {
      scheduler.updateSchedule('user-b', scheduleId, 'x', '0 9 * * *', 'x');
    }, /does not belong/);

    scheduler.shutdown();
  });
});
