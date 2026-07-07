import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { handleApproval } from '../modules/approval.js';
import { canAccess } from '../modules/auth.js';
import { sendTelegram } from '../services/telegram.js';
import { env } from '../config/env.js';

const decideBody = z.object({
  decision: z.enum(['approved', 'rejected']),
  decidedBy: z.string().min(1).default('rest'),
  reason: z.string().optional()
});

export default async function approvalsRoutes(app: FastifyInstance): Promise<void> {
  // REST: list pending approvals
  app.get('/trading/approvals', async () => {
    const rows = await db.select().from(schema.tradingApprovals);
    return { approvals: rows };
  });

  // REST: decide on approval (owner/trader via x-telegram-id, OR operator via x-api-key)
  app.post('/trading/approvals/:id/decide', async (req: FastifyRequest, reply: FastifyReply) => {
    const telegramId = req.headers['x-telegram-id'] as string | undefined;
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const apiKeyOk = !!(env.API_KEY && apiKey === env.API_KEY);
    const role = await resolveRole(telegramId);
    const telegramOk = !!(telegramId && role && canAccess(role, '/trading'));
    if (!apiKeyOk && !telegramOk) {
      return reply.status(403).send({ error: 'forbidden: owner/trader only' });
    }
    const id = (req.params as { id: string }).id;
    const parsed = decideBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', issues: parsed.error.issues });
    }
    // id param is setup id in our flow
    const res = await handleApproval(id, parsed.data.decision, parsed.data.decidedBy, parsed.data.reason);
    if (!res.ok) return reply.status(404).send({ error: 'setup not found' });
    return { ok: true, setupId: id, decision: parsed.data.decision };
  });
}

async function resolveRole(telegramId?: string): Promise<string | null> {
  if (!telegramId) return null;
  // Lazy import to avoid circular
  const { getUserByTelegramId } = await import('../modules/auth.js');
  const u = await getUserByTelegramId(Number(telegramId));
  return u?.role ?? null;
}