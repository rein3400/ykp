/**
 * Waste approval ΓÇö outlet_manager+ approves waste (brief ┬º10: waste di atas
 * threshold wajib approval).
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, forbidden, badRequest, notFound, conflict, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { canApprove } from '@/lib/rbac';

export const PATCH = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!canApprove(s.role)) return forbidden('Approval membutuhkan outlet_manager ke atas');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (body.action !== 'approve' && body.action !== 'reject') return badRequest('action harus approve atau reject');
  const found = await findRow(TABS.wasteLog, 'waste_id', params.id);
  if (!found) return notFound('Waste tidak ditemukan');
  if (found.row.approval_status === 'APPROVED') return conflict('Sudah di-approve');

  const before = { ...found.row };
  const updated = {
    ...found.row,
    approval_status: body.action === 'approve' ? 'APPROVED' : 'REJECTED',
    approved_by: s.userId
  };
  await updateRow(TABS.wasteLog, found.rowNumber, updated);
  await logAudit({
    module: 'ops', action: body.action, recordType: 'ops_waste_log', recordId: params.id,
    beforeValue: JSON.stringify(before), afterValue: JSON.stringify(updated),
    reason: body.reason ?? '', userId: s.userId, approvalUserId: s.userId
  }).catch(() => null);
  return ok(updated);
});
