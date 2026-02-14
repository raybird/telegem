import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export type MemoriaSyncTurn = {
  userId: string;
  userMessage: string;
  modelMessage: string;
  platform?: string;
  isPassthroughCommand: boolean;
  forceNewSession: boolean;
};

type MemoriaSyncMode = 'on' | 'off' | 'auto';

type MemoriaSyncOptions = {
  projectDir?: string;
  mode?: MemoriaSyncMode;
  timeoutMs?: number;
};

type SessionEvent = {
  id: string;
  timestamp: string;
  type: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

function parseMode(raw: string | undefined): MemoriaSyncMode {
  const normalized = (raw || 'auto').trim().toLowerCase();
  if (normalized === 'on' || normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return 'on';
  }
  if (normalized === 'off' || normalized === 'false' || normalized === '0' || normalized === 'no') {
    return 'off';
  }
  return 'auto';
}

function parseTimeout(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1000) return fallback;
  return parsed;
}

function ensureDir(targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });
}

function buildEvents(turn: MemoriaSyncTurn): SessionEvent[] {
  const now = new Date().toISOString();
  return [
    {
      id: randomUUID(),
      timestamp: now,
      type: 'UserMessage',
      content: {
        role: 'user',
        text: turn.userMessage
      },
      metadata: {
        source: 'telenexus',
        user_id: turn.userId,
        platform: turn.platform || 'telegram',
        is_passthrough_command: turn.isPassthroughCommand,
        force_new_session: turn.forceNewSession
      }
    },
    {
      id: randomUUID(),
      timestamp: now,
      type: 'ModelMessage',
      content: {
        role: 'model',
        text: turn.modelMessage
      },
      metadata: {
        source: 'telenexus',
        user_id: turn.userId,
        platform: turn.platform || 'telegram',
        is_passthrough_command: turn.isPassthroughCommand,
        force_new_session: turn.forceNewSession
      }
    }
  ];
}

function runOneSyncCommand(
  command: string,
  args: string[],
  memoriaHome: string,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: memoriaHome,
      env: {
        ...process.env,
        MEMORIA_HOME: memoriaHome
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`memoria sync timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`exit=${code}: ${stderr || stdout || '(empty)'}`));
    });
  });
}

async function runMemoriaSync(
  cliPath: string,
  memoriaHome: string,
  payloadPath: string,
  timeoutMs: number
): Promise<void> {
  const fallbackTsxCli = path.join(memoriaHome, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const attempts: Array<{ command: string; args: string[]; name: string }> = [
    { command: cliPath, args: ['sync', payloadPath], name: 'cli shim' }
  ];

  if (fs.existsSync(fallbackTsxCli)) {
    attempts.push({
      command: 'node',
      args: [fallbackTsxCli, 'src/cli.ts', 'sync', payloadPath],
      name: 'node+tsx fallback'
    });
  }

  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      await runOneSyncCommand(attempt.command, attempt.args, memoriaHome, timeoutMs);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = new Error(`${attempt.name} failed: ${message}`);
    }
  }

  throw lastError || new Error('memoria sync failed');
}

export class MemoriaSyncBridge {
  private readonly mode: MemoriaSyncMode;
  private readonly timeoutMs: number;
  private readonly projectDir: string;
  private readonly memoriaHome: string;
  private readonly cliPath: string;
  private readonly tempDir: string;
  private queue: Promise<void>;
  private disabled: boolean;

  constructor(options: MemoriaSyncOptions = {}) {
    this.mode = options.mode || parseMode(process.env.MEMORIA_SYNC_ENABLED);
    this.timeoutMs = options.timeoutMs || parseTimeout(process.env.MEMORIA_SYNC_TIMEOUT_MS, 20000);
    this.projectDir = path.resolve(
      options.projectDir || process.env.GEMINI_PROJECT_DIR || process.cwd()
    );
    this.memoriaHome = path.resolve(
      process.env.MEMORIA_HOME || path.join(this.projectDir, 'workspace', 'Memoria')
    );
    this.cliPath = path.resolve(process.env.MEMORIA_CLI_PATH || path.join(this.memoriaHome, 'cli'));
    this.tempDir = path.resolve(
      process.env.MEMORIA_SYNC_TEMP_DIR ||
        path.join(this.projectDir, 'workspace', 'temp', 'memoria-sync')
    );
    this.queue = Promise.resolve();
    this.disabled = false;

    if (this.mode === 'off') {
      console.log('[MemoriaSync] Disabled by MEMORIA_SYNC_ENABLED.');
      this.disabled = true;
      return;
    }

    if (!fs.existsSync(this.cliPath)) {
      const message = `[MemoriaSync] CLI not found: ${this.cliPath}`;
      if (this.mode === 'on') {
        console.warn(`${message} (mode=on, will keep retrying queue)`);
      } else {
        console.log(`${message} (mode=auto, disabled)`);
        this.disabled = true;
      }
      return;
    }

    try {
      ensureDir(this.tempDir);
      console.log(`[MemoriaSync] Enabled. memoriaHome=${this.memoriaHome}`);
    } catch (error) {
      console.warn('[MemoriaSync] Failed to prepare temp dir, disabling:', error);
      this.disabled = true;
    }
  }

  enqueueTurn(turn: MemoriaSyncTurn): void {
    if (this.disabled) {
      return;
    }

    this.queue = this.queue
      .then(async () => {
        const timestamp = Date.now();
        const sessionId = `telenexus_${timestamp}_${randomUUID().slice(0, 8)}`;
        const payload = {
          id: sessionId,
          timestamp: new Date(timestamp).toISOString(),
          project: 'TeleNexus',
          summary: `user=${turn.userId} platform=${turn.platform || 'telegram'} passthrough=${turn.isPassthroughCommand}`,
          events: buildEvents(turn)
        };

        const payloadPath = path.join(this.tempDir, `${sessionId}.json`);
        fs.writeFileSync(payloadPath, JSON.stringify(payload), 'utf8');

        try {
          await runMemoriaSync(this.cliPath, this.memoriaHome, payloadPath, this.timeoutMs);
          console.log(`[MemoriaSync] Synced session ${sessionId}`);
        } finally {
          try {
            fs.unlinkSync(payloadPath);
          } catch {
            // ignore cleanup failure
          }
        }
      })
      .catch((error) => {
        console.warn('[MemoriaSync] Sync failed:', error);
      });
  }
}
