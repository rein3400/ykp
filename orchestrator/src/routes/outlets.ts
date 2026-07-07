import type { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

export default async function outletRoutes(app: FastifyInstance): Promise<void> {
  app.get('/outlets', async () => {
    const rows = await db.select().from(schema.outlets);
    return { outlets: rows };
  });

  app.get('/outlets/:id', async (req) => {
    const id = (req.params as { id: string }).id;
    const res = await db.select().from(schema.outlets).where(eq(schema.outlets.outletId, id)).limit(1);
    return res[0] ?? { error: 'not found' };
  });
}