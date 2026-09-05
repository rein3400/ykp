/**
 * Receiver for Finance → HR payment notifications (MOM 1 Sep 2026 Tahap 4).
 *
 * The Finance app calls this after marking payroll paid ("Sudah Transfer →
 * Notif HR") so HR sees feedback without polling. Authenticated ONLY by the
 * shared `x-finance-secret` header (Finance has no HR session cookie).
 * Write-light: records an audit entry, never mutates payroll rows (Finance
 * already marked them paid via /mark-paid with its own HR session/role).
 */
import { logAudit } from '@/lib/audit';
import { financeSecretValid } from '@/lib/finance-secret';
import { handler, badRequest, unauthorized, ok } from '@/lib/http';
import { z } from 'zod';

const schema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  paid_count: z.number().int().min(0).default(0),
  note: z.string().max(500).default('')
});

export const POST = handler(async (req) => {
  if (!financeSecretValid(req)) return unauthorized('Invalid or missing x-finance-secret');
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  await logAudit({
    actorUserId: 'finance-app',
    actorRole: 'finance_admin',
    action: 'finance_notify_paid',
    entity: 'payroll',
    entityId: parsed.data.period,
    afterValue: `${parsed.data.paid_count} rows marked paid`,
    reason: parsed.data.note || undefined
  });
  return ok({ period: parsed.data.period, received: true });
});
