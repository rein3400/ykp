/**
 * Threshold edit with audit (Revisi #10 + #27): value/severity/scope/active
 * changes log before_value/after_value + changed_by.
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, notFound, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { can, type Role } from '@/lib/rbac';

const EDITABLE = ['label', 'explanation', 'value', 'unit', 'severity', 'scope', 'brand_id', 'outlet_id', 'active'] as const;

export const PATCH = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'threshold')) return forbidden('Forbidden');

  const found = await findRow(TABS.thresholdConfig, 'threshold_id', params.id);
  if (!found) return notFound(`threshold_id not found: ${params.id}`);

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const before = { ...found.row };
  const next = { ...found.row };
  for (const k of EDITABLE) {
    if (body[k] !== undefined) next[k] = body[k];
  }
  if (next.value !== undefined && !Number.isFinite(Number(next.value))) return badRequest('value must be numeric');
  next.last_changed = nowTimestampWib();
  next.changed_by = s.userId;

  await updateRow(TABS.thresholdConfig, found.rowNumber, next);
  await logAudit({
    module: 'finance', action: 'update', recordType: 'finance_threshold_config',
    recordId: params.id, beforeValue: JSON.stringify(before), afterValue: JSON.stringify(next),
    reason: body.reason ?? '', userId: s.userId
  }).catch(() => null);
  return ok(next);
});
