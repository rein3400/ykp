/**
 * Request revision on a payroll row — MOM 1 Sep 2026 "tombol Needs Revision".
 *
 * Flow: Finance sees a Ready-to-Pay row with wrong nominal → clicks
 * "Minta Revisi" with a mandatory reason → row returns to HR as
 * NEEDS_REVISION → HR fixes source data → re-generate → back to Finance.
 *
 * HR-side endpoint. Finance NEVER writes HR tabs directly (cross-domain
 * read-only invariant); the Finance app calls this route cross-app with the
 * shared `x-finance-secret` header, or a logged-in HR/Finance/Owner user
 * calls it with their HR session cookie.
 *
 * Transition: APPROVED + unpaid  →  NEEDS_REVISION (+reason/by/at).
 * PAID / LOCKED rows are rejected (use unlock flow instead).
 */
import { updateRow, TABS, findRow } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { financeSecretValid } from '@/lib/finance-secret';
import { handler, badRequest, unauthorized, forbidden, conflict, ok, notFound } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({
  payroll_id: z.string().min(1),
  reason: z.string().trim().min(5, 'Alasan revisi wajib diisi (min 5 karakter)').max(500)
});

export const POST = handler(async (req) => {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  // Auth: HR session with request_revision grant, OR cross-app finance secret.
  let actorUserId = 'finance-app';
  let actorRole = 'finance_admin';
  if (financeSecretValid(req)) {
    // cross-app call from Finance — actor recorded as finance app
  } else {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!can(session.role as Role, 'request_revision', 'payroll')) return forbidden();
    actorUserId = session.userId;
    actorRole = session.role;
  }

  const found = await findRow(TABS.payroll, 'payroll_id', parsed.data.payroll_id);
  if (!found) return notFound('Payroll not found');
  if (found.row.approval_status === 'NEEDS_REVISION') return conflict('Payroll already needs revision');
  if (found.row.approval_status !== 'APPROVED') {
    return conflict(`Only APPROVED (Ready to Pay) payroll can be sent back, current: ${found.row.approval_status || '-'}`);
  }
  if (found.row.payment_status === 'PAID') return conflict('Already paid — use unlock flow instead');
  if (found.row.locked_status === 'LOCKED') return conflict('Payroll is locked — unlock first');

  const now = nowTimestampWib();
  const updated = {
    ...found.row,
    approval_status: 'NEEDS_REVISION',
    revision_reason: parsed.data.reason,
    revision_by: actorUserId,
    revision_at: now,
    updated_at: now
  };
  await updateRow(TABS.payroll, found.rowNumber, updated);
  await logAudit({
    actorUserId,
    actorRole,
    action: 'request_revision',
    entity: 'payroll',
    entityId: parsed.data.payroll_id,
    reason: parsed.data.reason
  });
  return ok(updated);
});
