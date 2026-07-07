import type { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';

export default async function signalsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/trading/signals', async (req) => {
    const status = (req.query as { status?: string }).status;
    if (status) {
      const rows = await db.select().from(schema.tradingSetups)
        .where(eq(schema.tradingSetups.status, status as unknown as typeof schema.tradingSetups.status))
        .orderBy(desc(schema.tradingSetups.createdAt))
        .limit(10);
      return { status, signals: rows };
    }
    const rows = await db.select().from(schema.tradingSetups)
      .orderBy(desc(schema.tradingSetups.createdAt))
      .limit(20);
    return { signals: rows };
  });

  app.get('/trading/signals/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const rows = await db.select().from(schema.tradingSetups).where(eq(schema.tradingSetups.id, id)).limit(1);
    if (rows.length === 0) return reply.status(404).send({ error: 'not found' });
    return rows[0];
  });
}