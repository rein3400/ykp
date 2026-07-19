/**
 * Approve / reject / pay a supplier invoice (Revisi #6 + approval FSM).
 * - approve: PENDING → APPROVED
 * - reject:  PENDING → REJECTED
 * - pay:     APPROVED → PAID (full or partial). When payment_source is
 *            'petty_cash', a linked petty-cash OUT row is auto-created so the
 *            summary never double counts (Revisi #4).
 * RBAC: finance_admin+ (amount tiers enforced by lib/approval).
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, appendRows, readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, notFound, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, todayWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { canApprove, type Role } from '@/lib/rbac';
import { transitionApproval, type ApprovalStatus } from '@/lib/approval';

export const POST = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!canApprove(s.role as Role)) return forbidden('Approval membutuhkan role finance_admin atau lebih tinggi');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const action = (body.action ?? '').toLowerCase();
  if (!['approve', 'reject', 'pay'].includes(action)) return badRequest("action must be 'approve' | 'reject' | 'pay'");

  const found = await findRow(TABS.supplierCost, 'costing_id', params.id);
  if (!found) return notFound(`costing_id not found: ${params.id}`);

  const before = { ...found.row };
  const next = { ...found.row };
  const currentApproval = (before.approval_status || 'PENDING') as ApprovalStatus;
  const remaining = Number(before.unpaid_amount || 0);

  if (action === 'approve' || action === 'reject') {
    const to: ApprovalStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const r = transitionApproval(
      { id: params.id, entity: 'supplier_cost', amount: Number(before.total_amount || 0), status: currentApproval },
      currentApproval, to, { id: s.userId, role: s.role }
    );
    if (!r.ok) return badRequest(r.error ?? 'transition not allowed');
    next.approval_status = to;
    next.approved_by = action === 'approve' ? s.userId : '';
  } else {
    // pay
    if (remaining <= 0) return badRequest('Invoice sudah lunas');
    const payAmount = body.paid_amount ? Math.trunc(Number(body.paid_amount)) : remaining;
    if (!Number.isFinite(payAmount) || payAmount <= 0) return badRequest('paid_amount must be > 0');
    if (payAmount > remaining) return badRequest(`paid_amount melebihi sisa tagihan (${remaining})`);

    // FSM: allow pay directly from PENDING (auto-approve) or APPROVED
    if (currentApproval === 'PENDING') {
      const a = transitionApproval(
        { id: params.id, entity: 'supplier_cost', amount: Number(before.total_amount || 0), status: 'PENDING' },
        'PENDING', 'APPROVED', { id: s.userId, role: s.role }
      );
      if (!a.ok) return badRequest(a.error ?? 'approve failed');
      next.approved_by = s.userId;
    } else if (currentApproval !== 'APPROVED') {
      return badRequest(`Tidak bisa membayar invoice dengan approval_status ${currentApproval}`);
    }

    const total = Number(before.total_amount || 0);
    const newPaid = Number(before.paid_amount || 0) + payAmount;
    next.paid_amount = String(newPaid);
    next.unpaid_amount = String(Math.max(0, total - newPaid));
    next.payment_status = newPaid >= total ? 'PAID' : 'PARTIAL';
    next.payment_date = body.payment_date || todayWib();
    next.payment_ref = body.payment_ref || '';
    next.payment_source = body.payment_source || 'transfer';
    next.approval_status = newPaid >= total ? 'PAID' : 'APPROVED';
    next.approved_by = s.userId;

    // Revisi #4: dibayar lewat kas kecil → catat petty OUT dengan link (anti double count)
    if ((body.payment_source ?? '') === 'petty_cash') {
      const accountId = body.petty_account_id;
      if (!accountId) return badRequest('petty_account_id is required when payment_source=petty_cash');
      const accounts = await readTab<Record<string, string>>(TABS.pettyCashAccounts);
      const account = accounts.find((a) => a.account_id === accountId);
      if (!account) return badRequest(`petty account not found: ${accountId}`);
      const pettyRows = await readTab<Record<string, string>>(TABS.pettyCash);
      const last = pettyRows
        .filter((p) => p.account_id === accountId)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
        .at(-1);
      const newBalance = Number(last?.running_balance || account.opening_balance || 0) - payAmount;
      await appendRows(TABS.pettyCash, [{
        petty_id: nextSequentialIdSync('PC'),
        date: next.payment_date,
        brand_id: before.brand_id,
        brand_name: before.brand_name,
        outlet_id: before.outlet_id,
        outlet_name: before.outlet_name,
        account_id: accountId,
        description: `Bayar invoice ${before.invoice_number || params.id} — ${before.supplier_name}`,
        category: before.category || 'Supplier',
        qty: '1',
        unit: '',
        debit_topup: '0',
        credit_out: String(payAmount),
        running_balance: String(newBalance),
        physical_cash: '',
        cash_difference: '',
        closing_status: '',
        cash_on_hand_status: 'OK',
        receipt_url: body.payment_ref ? `ref:${body.payment_ref}` : '',
        urgent_flag: 'false',
        approval_status: 'APPROVED',
        approved_by: s.userId,
        notes: 'Auto-created dari approve-payment supplier',
        source_module: 'supplier',
        source_transaction_id: params.id,
        payment_source: 'petty_cash',
        linked_expense_id: '',
        linked_supplier_invoice_id: params.id,
        created_by: s.userId,
        created_at: nowTimestampWib()
      }]);
    }
  }

  next.updated_at = nowTimestampWib();
  await updateRow(TABS.supplierCost, found.rowNumber, next);
  await logAudit({
    module: 'finance', action: `approve-payment:${action}`, recordType: 'fin_supplier_cost',
    recordId: params.id, beforeValue: JSON.stringify(before), afterValue: JSON.stringify(next),
    reason: body.reason ?? '', userId: s.userId, approvalUserId: s.userId
  }).catch(() => null);
  return ok(next);
});
