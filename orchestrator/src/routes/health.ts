import type { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { redisPing } from '../services/redis.js';
import { env } from '../config/env.js';
import { pingQdrant } from '../services/vector-db.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const checks = await runHealth();
    const allOk = Object.values(checks).every((v) => v === 'ok' || v === 'configured' || v === 'stub');
    return { status: allOk ? 'ok' : 'degraded', checks, ts: new Date().toISOString() };
  });

  app.get('/health/detail', async () => {
    const checks = await runHealth(true);
    return { checks, env: env.NODE_ENV, version: '1.0.0', ts: new Date().toISOString() };
  });
}

async function runHealth(detail = false): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  out.api = 'ok';

  try {
    await db.execute(sql`SELECT 1`);
    out.postgres = 'ok';
  } catch (e) {
    out.postgres = detail ? `down: ${(e as Error).message}` : 'down';
  }

  out.redis = (await redisPing()) ? 'ok' : 'down';
  out.qdrant = (await pingQdrant()) ? 'ok' : 'down';

  out.telegram = env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_OWNER_CHAT_ID ? 'configured' : 'not-configured';
  out.openai = env.OPENAI_API_KEY ? 'configured' : 'not-configured';
  out.ollama = env.OLLAMA_BASE_URL ? 'configured' : 'not-configured';
  out.embedding_provider = env.OPENAI_API_KEY || env.OLLAMA_BASE_URL ? 'configured' : 'not-configured';
  out.news_provider = env.NEWS_PROVIDER === 'stub' ? 'stub' : env.NEWS_API_KEY ? 'configured' : 'not-configured';
  out.mt5_bridge = env.MT5_BRIDGE_URL ? 'configured (http)' : 'mock (phase 2)';

  return out;
}
