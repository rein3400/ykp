import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { handleHr } from '../modules/hr-bot.js';

const reportSchema = z.object({ filter: z.string().default('telat hari ini') });

export default async function hrRoutes(app: FastifyInstance): Promise<void> {
  app.post('/hr/report', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = reportSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    const result = await handleHr(parsed.data.filter);
    return reply.send({ report: result });
  });
}