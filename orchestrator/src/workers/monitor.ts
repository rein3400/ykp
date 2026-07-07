import { redisPing } from '../services/redis.js';
import { db, schema } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { sendToOwner } from '../modules/telegram-bot.js';
import { logSystem, logger } from '../services/logger.js';

interface MonitorResult {
  service: string;
  status: 'ok' | 'down';
  detail?: string;
}

export async function runMonitor(): Promise<MonitorResult[]> {
  const results: MonitorResult[] = [];

  // API = assumed running if this code executes

  // Postgres
  try {
    await db.execute(sql`SELECT 1`);
    results.push({ service: 'postgres', status: 'ok' });
  } catch (e) {
    results.push({ service: 'postgres', status: 'down', detail: (e as Error).message });
  }

  // Redis
  const redisOk = await redisPing();
  results.push({ service: 'redis', status: redisOk ? 'ok' : 'down' });

  // Phase 2: expire stale pending approvals
  try {
    const { expirePending } = await import('../modules/approval.js');
    await expirePending();
  } catch (err) {
    logger.error({ err }, 'monitor expirePending failed');
  }

  const failed = results.filter((r) => r.status === 'down');
  if (failed.length > 0) {
    const text = `YKP SERVER WARNING\n${failed.map((f) => `${f.service}: ${f.status.toUpperCase()}${f.detail ? `\n  ${f.detail}` : ''}`).join('\n')}\nAction: Please check server.`;
    await sendToOwner(text).catch(() => {});
    await logSystem('error', 'monitor', 'monitor detected failures', { failed });
  }
  return results;
}