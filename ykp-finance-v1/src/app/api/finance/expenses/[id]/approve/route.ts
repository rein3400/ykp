/**
 * Approve / reject an expense (amount > Rp500.000 arrives as PENDING).
 * RBAC: finance_admin+ with amount tiers from lib/approval.
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, notFound, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { canApprove, type Role } from '@/lib/rbac';
import { transitionApproval, type ApprovalStatus } from '@/lib/approval';

export const POST = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!canApprove(s.role as Role)) return forbidden('Approval membutuhkan role finance_admin atau lebih tinggi');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const action = (body.action ?? '').toLowerCase();
  if (!['approve', 'reject'].includes(action)) return badRequest("action must be 'approve' | 'reject'");

  const found = await findRow(TABS.expense, 'expense_id', params.id);
  if (!found) return notFound(`expense_id not found: ${params.id}`);

  const before = { ...found.row };
  const current = (before.approval_status || 'DRAFT') as ApprovalStatus;
  const to: ApprovalStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
  const r = transitionApproval(
    { id: params.id, entity: 'expense', amount: Number(before.amount || 0), status: current },
    current, to, { id: s.userId, role: s.role }
  );
  if (!r.ok) return badRequest(r.error ?? 'transition not allowed');

  const next = {
    ...before,
    approval_status: to,
    approved_by: action === 'approve' ? s.userId : '',
    updated_at: nowTimestampWib()
  };
  await updateRow(TABS.expense, found.rowNumber, next);
  await logAudit({
    module: 'finance', action: `approve:${action}`, recordType: 'fin_expense',
    recordId: params.id, beforeValue: JSON.stringify(before), afterValue: JSON.stringify(next),
    reason: body.reason ?? '', userId: s.userId, approvalUserId: s.userId
  }).catch(() => null);
  return ok(next);
});
