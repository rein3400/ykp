import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { handleFinance } from '../modules/finance-bot.js';

const reportSchema = z.object({ period: z.string().default('minggu ini') });

export default async function financeRoutes(app: FastifyInstance): Promise<void> {
  app.post('/finance/report', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = reportSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    const result = await handleFinance(parsed.data.period);
    return reply.send({ report: result });
  });
}