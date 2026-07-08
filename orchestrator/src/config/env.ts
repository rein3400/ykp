import { z } from 'zod';
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');
expand(config({ path: envPath }));

// ponytail: ceiling = strict strings + Zod v4 native coercion; upgrade when env-schema lib adds typed-string booleans.
// Zod z.coerce.boolean() coerces ANY non-empty string to true (including "false"). Parse explicitly so truthy strings opt-in.
const flagBool = z.preprocess((v) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'off' || s === 'no') return false;
  if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true;
  return Boolean(s);
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  DATABASE_URL: z.string().startsWith('postgres://').min(1),
  REDIS_URL: z.string().startsWith('redis://').min(1),

  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_OWNER_CHAT_ID: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_MODE: flagBool.default(false),

  TRADINGVIEW_WEBHOOK_SECRET: z.string().min(1).optional(),

  OPENAI_API_KEY: z.string().min(1).optional(),
  DEFAULT_AI_MODEL: z.enum(['gpt', 'qwen']).default('gpt'),
  LOCAL_AI_MODEL: z.string().default('qwen2.5:7b'),
  // Ollama base URL — supports local (http://ollama:11434) or cloud (https://ollama.com).
  // Ollama cloud is detected by the URL containing 'ollama.com' or 'api.ollama.ai'.
  OLLAMA_BASE_URL: z.string().url().default('http://ollama:11434'),
  // Required when OLLAMA_BASE_URL points to Ollama cloud. Leave blank for local.
  OLLAMA_API_KEY: z.string().optional(),

  CLOUDFLARE_TUNNEL_TOKEN: z.string().min(1).optional(),
  PUBLIC_BASE_URL: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  API_KEY: z.string().min(1).optional(),

  DAILY_REPORT_CRON: z.string().min(1).default('30 23 * * *'),
  BACKUP_CRON: z.string().min(1).default('0 3 * * *'),
  MONITOR_INTERVAL_SECONDS: z.coerce.number().int().min(10).default(60),
  BACKUP_DIR: z.string().min(1).default('/var/lib/ykp/backups'),

  SETUP_TTL_MINUTES: z.coerce.number().int().min(1).default(240),

  // HERMES — Vector DB + embeddings
  QDRANT_URL: z.string().url().default('http://qdrant:6333'),
  QDRANT_COLLECTION: z.string().min(1).default('hermes_knowledge'),
  EMBED_PROVIDER: z.enum(['openai', 'ollama']).default('openai'),
  EMBED_MODEL: z.string().min(1).default('text-embedding-3-small'),
  EMBED_FALLBACK_MODEL: z.string().min(1).default('nomic-embed-text'),
  EMBED_DIM: z.coerce.number().int().min(64).max(4096).default(1536),
  KNOWLEDGE_ROOT: z.string().min(1).default('../Hermes_Knowledge'),

  // News filter — stub mode unless NEWS_API_KEY set
  NEWS_PROVIDER: z.enum(['stub', 'forexfactory', 'investing']).default('stub'),
  NEWS_API_KEY: z.string().optional(),
  NEWS_WINDOW_MIN: z.coerce.number().int().min(5).max(240).default(30),
  NEWS_FILTER_ENABLED: flagBool.default(true),

  // Scoring + risk
  SCORE_THRESHOLD: z.coerce.number().int().min(0).max(100).default(80),
  SESSION_STRICT: flagBool.default(true),
  RISK_ACCOUNT_USD: z.coerce.number().min(0).default(10000),
  RISK_PCT_PER_TRADE: z.coerce.number().min(0.01).max(10).default(0.5),
  RR_TARGET: z.coerce.number().min(1).max(20).default(2),

  // Phase 2
  APPROVAL_TTL_MIN: z.coerce.number().int().min(1).default(15),
  TELEGRAM_APPROVER_CHAT_IDS: z.string().optional(),

  // Phase 3
  MT5_BRIDGE_URL: z.string().url().optional(),
  MT5_BRIDGE_TOKEN: z.string().min(1).optional(),
  MT5_BRIDGE_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
  MT5_MAX_CONCURRENT_TRADES: z.coerce.number().int().min(1).max(50).default(3),
  MT5_BREAKER_THRESHOLD: z.coerce.number().int().min(1).default(3)
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Environment validation failed:\n${issues}`);
  throw new Error(`Environment validation failed:\n${issues}`);
}
export const env = parsed.data;
