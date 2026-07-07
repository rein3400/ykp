import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { handleSop } from '../modules/sop-bot.js';

const searchSchema = z.object({ query: z.string().min(1) });

export default async function sopRoutes(app: FastifyInstance): Promise<void> {
  app.post('/sop/search', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    const result = await handleSop(parsed.data.query);
    return reply.send({ answer: result });
  });
}