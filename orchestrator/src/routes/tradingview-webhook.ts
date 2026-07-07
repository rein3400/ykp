import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { processAlert, type TradingWebhookPayload } from '../modules/trading-engine.js';
import { logger } from '../services/logger.js';
import { z } from 'zod';

const payloadSchema = z.object({
  source: z.string().default('tradingview'),
  pair: z.string().min(1),
  timeframe: z.string().min(1),
  signal: z.string().min(1),
  price: z.union([z.string(), z.number()]),
  session: z.string().optional().default(''),
  timestamp: z.string().optional(),
  bar_index: z.number().optional()
});

export default async function tradingviewWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/tradingview/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    // Secret via header or query
    const provided = req.headers['x-webhook-secret'] as string | undefined
      ?? (req.query as { secret?: string }).secret;
    if (env.TRADINGVIEW_WEBHOOK_SECRET && provided !== env.TRADINGVIEW_WEBHOOK_SECRET) {
      logger.warn({ url: req.url }, 'tradingview webhook unauthorized');
      return reply.status(401).send({ error: 'unauthorized' });
    }
    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid payload', issues: parsed.error.issues });
    }
    try {
      const result = await processAlert(parsed.data as TradingWebhookPayload);
      return reply.send({
        ok: true,
        status: result.status,
        next: result.next,
        state: result.state
      });
    } catch (err) {
      logger.error({ err }, 'tradingview webhook handler error');
      return reply.status(500).send({ ok: false, error: (err as Error).message });
    }
  });
}