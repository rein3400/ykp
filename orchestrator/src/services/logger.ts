import pino from 'pino';
import { env } from '../config/env.js';
import { nanoid } from 'nanoid';

const isDev = env.NODE_ENV !== 'production';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined,
  base: { service: 'ykp-orchestrator' },
  formatters: {
    level: (label) => ({ level: label })
  }
});

export async function logSystem(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal', service: string, message: string, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    const { db, schema } = await import('../db/index.js');
    await db.insert(schema.systemLogs).values({
      id: `LOG-${nanoid(12)}`,
      service,
      level,
      message,
      meta
    });
  } catch {
    // DB may be down; do not crash
  }
  logger.child({ service })[level === 'trace' ? 'trace' : level](meta, message);
}