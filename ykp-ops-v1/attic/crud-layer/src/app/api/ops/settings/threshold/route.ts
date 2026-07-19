/**
 * Threshold config editor ΓÇö owner/super_admin only (brief ┬º10: threshold
 * change wajib approval). Writes before/after audit (sensitive field).
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, forbidden, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';

export const PATCH = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner' && s.role !== 'super_admin') {
    return forbidden('Perubahan threshold membutuhkan owner / super_admin');
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.threshold_id) return badRequest('threshold_id wajib diisi');
  if (body.value === undefined || body.value === '') return badRequest('value wajib diisi');

  const found = await findRow(TABS.thresholdConfig, 'threshold_id', body.threshold_id);
  if (!found) return notFound('Threshold tidak ditemukan');
  const before = { ...found.row };
  const updated = { ...found.row };
  for (const k of ['value', 'severity', 'active_status', 'explanation']) {
    if (body[k] !== undefined) updated[k] = body[k];
  }
  updated.last_changed_at = nowTimestampWib();
  updated.changed_by = s.userId;

  await updateRow(TABS.thresholdConfig, found.rowNumber, updated);
  await logAudit({
    module: 'ops', action: 'threshold_change', recordType: 'ops_threshold_config', recordId: body.threshold_id,
    beforeValue: JSON.stringify(before), afterValue: JSON.stringify(updated),
    reason: body.reason ?? '', userId: s.userId, approvalUserId: s.userId
  }).catch(() => null);
  return ok(updated);
});
