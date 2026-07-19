/**
 * Closing approval ΓÇö outlet_manager+ approves a cash reconciliation, which
 * LOCKS it (brief ┬º6.7: lock after approval, reopen only by super admin).
 * Writes before/after audit (sensitive field).
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, forbidden, badRequest, notFound, conflict, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { canApprove } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';

export const PATCH = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!canApprove(s.role)) return forbidden('Approval membutuhkan outlet_manager ke atas');

  const id = params.id;
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const found = await findRow(TABS.cashReconciliation, 'reconciliation_id', id);
  if (!found) return notFound('Rekonsiliasi tidak ditemukan');
  const before = { ...found.row };
  const updated = { ...found.row };

  if (body.action === 'approve') {
    if (found.row.approval_status === 'APPROVED') return conflict('Sudah di-approve dan terkunci');
    updated.approval_status = 'APPROVED';
    updated.approved_by = s.userId;
    updated.closed_at = nowTimestampWib();
  } else if (body.action === 'reopen') {
    if (s.role !== 'super_admin' && s.role !== 'owner') return forbidden('Reopen hanya oleh super_admin');
    if (found.row.approval_status !== 'APPROVED') return badRequest('Hanya rekonsiliasi APPROVED yang bisa di-reopen');
    updated.approval_status = 'PENDING';
    updated.approved_by = '';
    updated.closed_at = '';
  } else {
    return badRequest('action harus approve atau reopen');
  }

  await updateRow(TABS.cashReconciliation, found.rowNumber, updated);
  await logAudit({
    module: 'ops', action: body.action === 'approve' ? 'approve_lock' : 'reopen',
    recordType: 'ops_cash_reconciliation', recordId: id,
    beforeValue: JSON.stringify(before), afterValue: JSON.stringify(updated),
    reason: body.reason ?? '', userId: s.userId, approvalUserId: s.userId
  }).catch(() => null);
  return ok(updated);
});
