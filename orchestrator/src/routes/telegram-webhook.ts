import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getBot } from '../modules/telegram-bot.js';
import { env } from '../config/env.js';
import { logger } from '../services/logger.js';

export default async function telegramWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/telegram/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    try {
      const bot = getBot();
      await bot.handleUpdate(req.body as unknown as Parameters<typeof bot.handleUpdate>[0]);
      return reply.send({ ok: true });
    } catch (err) {
      logger.error({ err }, 'telegram webhook error');
      return reply.status(500).send({ ok: false });
    }
  });
}