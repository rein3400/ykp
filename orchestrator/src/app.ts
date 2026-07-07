import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { logger } from './services/logger.js';
import { healthRoutes } from './routes/health.js';
import staticPlugin from '@fastify/static';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    bodyLimit: 1_000_000,
    trustProxy: true
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", env.CORS_ORIGIN ?? "'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"]
      }
    }
  });
  const allowedOrigins = (env.CORS_ORIGIN ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: false
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: (req) => {
      const u = req.url ?? '';
      return u === '/health' || u.startsWith('/tradingview/webhook') || u.startsWith('/telegram/webhook');
    }
  });

  app.get('/', async () => ({ name: 'YKP AI Orchestrator', version: '1.0.0', docs: '/health', dashboard: '/dashboard' }));

  await app.register(staticPlugin, {
    root: new URL('../dashboard', import.meta.url).pathname,
    prefix: '/dashboard/',
    index: 'index.html'
  });

  app.get('/dashboard', async (req, reply) => reply.sendFile('index.html'));

  await app.register(healthRoutes, { prefix: '' });

  // route modules registered lazily (avoid load order issues)
  await registerRoutes(app);

  app.setErrorHandler((err, req, reply) => {
    logger.error({ err, url: req.url }, 'request error');
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    reply.status(status).send({ error: (err as Error).message });
  });

  return app;
}

async function registerRoutes(app: FastifyInstance): Promise<void> {
  // dynamic imports to keep foundation phase standalone
  const mods: Array<{ default: (app: FastifyInstance) => Promise<void>; prefix?: string }> = [];
  const routeFiles = [
    './routes/telegram-webhook.js',
    './routes/tradingview-webhook.js',
    './routes/ai-chat.js',
    './routes/reports.js',
    './routes/outlets.js',
    './routes/trading-journal.js',
    './routes/sop-search.js',
    './routes/finance.js',
    './routes/hr.js',
    './routes/screenshot.js',
    './routes/erp.js',
    './routes/memory.js',
    './routes/knowledge.js',
    './routes/signals.js',
    './routes/approvals.js',
    './routes/dashboard-api.js'
  ];
  for (const f of routeFiles) {
    try {
      const mod = await import(f);
      if (typeof mod.default === 'function') {
        mods.push(mod as { default: (app: FastifyInstance) => Promise<void> });
      }
    } catch {
      // route not implemented yet in this phase — skip
    }
  }
  for (const m of mods) {
    await m.default(app);
  }
}

export { env };