import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { syncOutletsToErp, pushSalesToErp } from '../modules/erp.js';

const pushSchema = z.object({ date: z.string().optional() });

export default async function erpRoutes(app: FastifyInstance): Promise<void> {
  app.post('/erp/sync-outlets', async (_req: FastifyRequest, reply: FastifyReply) => {
    const res = await syncOutletsToErp();
    return reply.send(res);
  });

  app.post('/erp/push-sales', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = pushSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
    const res = await pushSalesToErp(date);
    return reply.send(res);
  });
}