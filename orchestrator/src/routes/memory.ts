import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getMemory, listMemory, upsertMemory, deleteMemory } from '../modules/memory.js';

const upsertSchema = z.object({ scope: z.string().min(1), key: z.string().min(1), value: z.string() });

export default async function memoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/memory/:scope', async (req) => {
    const scope = (req.params as { scope: string }).scope;
    const rows = await listMemory(scope);
    return { items: rows };
  });

  app.get('/memory/:scope/:key', async (req, reply) => {
    const { scope, key } = req.params as { scope: string; key: string };
    const rec = await getMemory(scope, key);
    if (!rec) return reply.status(404).send({ error: 'not found' });
    return rec;
  });

  app.post('/memory', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    const rec = await upsertMemory(parsed.data.scope, parsed.data.key, parsed.data.value);
    return reply.send(rec);
  });

  app.delete('/memory/:id', async (req) => {
    const id = (req.params as { id: string }).id;
    await deleteMemory(id);
    return { ok: true };
  });
}