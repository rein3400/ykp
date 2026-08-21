/**
 * Approve / reject / pay a supplier invoice (Revisi #6 + approval FSM).
 * - approve: PENDING → APPROVED
 * - reject:  PENDING → REJECTED
 * - pay:     APPROVED → PAID (full or partial). When payment_source is
 *            'petty_cash', a linked petty-cash OUT row is auto-created so the
 *            summary never double counts (Revisi #4).
 * RBAC: finance_admin+ (amount tiers enforced by lib/approval).
 *
 * Bug #2: the pay path is guarded by `guardedUpdateRow` (optimistic concurrency
 * on `updated_at`) so two concurrent pays cannot both read the same
 * `unpaid_amount` and silently lose a payment.
 * Bug #9: when paying via petty_cash, balance sufficiency + the account
 * `daily_limit` are checked before the petty OUT row is created, so
 * `running_balance` never goes negative from this path.
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, appendRows, readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, notFound, handler, forbidden, conflict } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, todayWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { canApprove, type Role } from '@/lib/rbac';
import { transitionApproval, type ApprovalStatus } from '@/lib/approval';
import { guardedUpdateRow, ConcurrentUpdateError } from '@/lib/concurrency';
import { isInactiveStatus } from '@/lib/fin-summary';

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
    next.updated_at = nowTimestampWib();
    await updateRow(TABS.supplierCost, found.rowNumber, next);
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

    // Revisi #4: dibayar lewat kas kecil → catat petty OUT dengan link (anti double count).
    // Bug #9: validate balance sufficiency + daily_limit BEFORE committing, so the
    // auto-created petty OUT never drives running_balance negative. Balance is taken
    // from the latest row by petty_id (monotonic ts-based id), not created_at.
    let pettyPayload: Record<string, string> | null = null;
    if ((body.payment_source ?? '') === 'petty_cash') {
      const accountId = body.petty_account_id;
      if (!accountId) return badRequest('petty_account_id is required when payment_source=petty_cash');
      const [accounts, pettyRows] = await Promise.all([
        readTab<Record<string, string>>(TABS.pettyCashAccounts),
        readTab<Record<string, string>>(TABS.pettyCash)
      ]);
      const account = accounts.find((a) => a.account_id === accountId);
      if (!account) return badRequest(`petty account not found: ${accountId}`);
      const last = pettyRows
        .filter((p) => p.account_id === accountId)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.petty_id ?? '').localeCompare(b.petty_id ?? ''))
        .at(-1);
      const prevBalance = Number(last?.running_balance || account.opening_balance || 0);
      const newBalance = prevBalance - payAmount;
      if (newBalance < 0) return badRequest(`Saldo kas kecil tidak cukup (saldo ${prevBalance}, keluar ${payAmount})`);
      const dailyLimit = Number(account.daily_limit || 0);
      if (dailyLimit > 0) {
        const paidDate = next.payment_date;
        const spentToday = pettyRows
          .filter((p) => p.account_id === accountId && p.date === paidDate && !isInactiveStatus(p.approval_status))
          .reduce((sum, p) => sum + Number(p.credit_out || 0), 0);
        if (spentToday + payAmount > dailyLimit) {
          return badRequest(`Pengeluaran kas kecil hari ini melebihi daily_limit (limit ${dailyLimit}, sudah keluar ${spentToday}, keluar ${payAmount})`);
        }
      }
      pettyPayload = {
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
      };
    }

    // Bug #2: optimistic-concurrency guard on the invoice write. A concurrent pay
    // that already moved updated_at would otherwise silently lose a payment; the
    // guard rejects with 409 instead. Petty OUT is only created after the invoice
    // write wins, so a failed invoice write never leaves an orphan petty row.
    next.updated_at = nowTimestampWib();
    try {
      await guardedUpdateRow(TABS.supplierCost, 'costing_id', params.id, found, next);
    } catch (e) {
      if (e instanceof ConcurrentUpdateError) return conflict(e.message);
      throw e;
    }
    if (pettyPayload) await appendRows(TABS.pettyCash, [pettyPayload]);
  }

  await logAudit({
    module: 'finance', action: `approve-payment:${action}`, recordType: 'fin_supplier_cost',
    recordId: params.id, beforeValue: JSON.stringify(before), afterValue: JSON.stringify(next),
    reason: body.reason ?? '', userId: s.userId, approvalUserId: s.userId
  }).catch(() => null);
  return ok(next);
});