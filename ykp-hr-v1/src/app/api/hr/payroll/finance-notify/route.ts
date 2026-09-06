/**
 * Finance -> HR transfer notification. Finance marks payroll period/brand as transferred,
 * HR sees finance_notified_at. Auth: HR session with payroll approve/mark_paid OR shared
 * header x-finance-secret matching FINANCE_NOTIFY_SECRET (for service-to-service).
 *
 * PATCH (hr-integrity, 2026-09-06): bulk path no longer uses loop index `i + 2`
 * as the row identity. That only holds for dense Sheets row numbers; on Postgres
 * `__rownum` is a BIGSERIAL with gaps after deletes, so `i + 2` can overwrite
 * the WRONG payroll row (full-row overwrite of another employee's payroll) or
 * hit a nonexistent row while still counting `updated++`. The bulk path now
 * resolves each candidate via stable findRow(payroll_id) — the same pattern
 * the explicit payroll_ids branch already used — rechecks period/brand/notified
 * on the FRESH row (readTab snapshots can be stale: 10s cache in sheets.ts),
 * guards payroll_id identity, and writes from fresh fields so concurrent
 * updates (e.g. approval_status) are not clobbered.
 */
import { readTab, updateRow, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, ok } from '@/lib/http';
import { can, type Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({
  payroll_period: z.string().regex(/^\d{4}-\d{2}$/),
  brand_id: z.string().optional(),
  payroll_ids: z.array(z.string()).optional()
});

export const POST = handler(async (req) => {
  const secret = process.env.FINANCE_NOTIFY_SECRET?.trim();
  const headerSecret = req.headers.get('x-finance-secret')?.trim() ?? '';
  const isServiceCall = Boolean(secret && headerSecret && headerSecret === secret);

  let actorId = 'finance';
  let actorRole = 'finance_admin';

  if (!isServiceCall) {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!can(session.role as Role, 'mark_paid', 'payroll') && !can(session.role as Role, 'approve', 'payroll')) return forbidden();
    actorId = session.userId;
    actorRole = session.role;
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const { payroll_period, brand_id, payroll_ids } = parsed.data;
  const now = nowTimestampWib();
  let updated = 0;

  if (payroll_ids && payroll_ids.length > 0) {
    for (const pid of payroll_ids) {
      const found = await findRow(TABS.payroll, 'payroll_id', pid);
      if (!found) continue;
      await updateRow(TABS.payroll, found.rowNumber, { ...found.row, finance_notified_at: now, finance_notified_by: actorId, updated_at: now });
      updated++;
    }
  } else {
    const rows = await readTab<Record<string, string>>(TABS.payroll);
    for (const r of rows) {
      // Cheap pre-filter on the (possibly stale) snapshot; authority is the
      // fresh row fetched below. Business semantics preserved: same period /
      // brand / not-yet-notified predicates as before.
      if (r.payroll_period !== payroll_period) continue;
      if (brand_id && r.brand_id !== brand_id) continue;
      if (r.finance_notified_at) continue;
      const pid = r.payroll_id;
      if (!pid) continue;
      // Stable identity: resolve the real row (Sheets row number or Postgres
      // __rownum) by key instead of assuming dense `index + 2` positions.
      const found = await findRow(TABS.payroll, 'payroll_id', pid);
      if (!found) continue;
      // Recheck predicates on FRESH fields — the snapshot may predate a
      // concurrent edit (period/brand change, or already notified).
      if (found.row.payroll_period !== payroll_period) continue;
      if (brand_id && found.row.brand_id !== brand_id) continue;
      if (found.row.finance_notified_at) continue;
      // Never write to a row whose identity does not match the candidate.
      if (found.row.payroll_id !== pid) continue;
      await updateRow(TABS.payroll, found.rowNumber, { ...found.row, finance_notified_at: now, finance_notified_by: actorId, updated_at: now });
      updated++;
    }
  }

  await logAudit({
    actorUserId: actorId,
    actorRole,
    action: 'finance_notify_transfer',
    entity: 'payroll',
    entityId: payroll_period
  });

  return ok({ updated, payroll_period, brand_id: brand_id ?? null });
});
