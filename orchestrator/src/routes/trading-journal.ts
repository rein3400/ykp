import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { addJournalEntry, listJournal, updateJournalResult } from '../modules/journal.js';

const createSchema = z.object({
  pair: z.string().min(1),
  bias: z.enum(['BUY', 'SELL']),
  setupType: z.string().min(1),
  entry: z.string().min(1),
  sl: z.string().optional(),
  tp: z.string().optional(),
  notes: z.string().optional()
});

const updateSchema = z.object({ result: z.string().min(1) });

export default async function journalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/trading/journal', async () => {
    const rows = await listJournal(20);
    return { entries: rows };
  });

  app.post('/trading/journal', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    const res = await addJournalEntry(parsed.data);
    return reply.send(res);
  });

  app.patch('/trading/journal/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = (req.params as { id: string }).id;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    await updateJournalResult(id, parsed.data.result);
    return reply.send({ ok: true });
  });
}