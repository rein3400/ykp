/**
 * GET /api/finance/export?resource=pos|expenses|suppliers|summary&from=&to=&outlet_id=
 * Exports finance data as CSV (UTF-8 BOM for Excel). RBAC: export action.
 * Returns a downloadable CSV file.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { can, type Role } from '@/lib/rbac';
import { toCsv } from '@/lib/csv';

const RESOURCES = ['pos', 'expenses', 'suppliers', 'summary'] as const;
type Resource = (typeof RESOURCES)[number];

const HEADERS: Record<Resource, string[]> = {
  pos: ['pos_id', 'date', 'brand_name', 'outlet_name', 'gross_sales', 'net_sales', 'discount', 'refund', 'void', 'tax', 'service_charge', 'settle_cash', 'settle_qris', 'settle_card', 'settle_transfer', 'settle_marketplace', 'total_settlement', 'settlement_difference', 'transaction_count', 'aov', 'shift', 'source', 'created_at'],
  expenses: ['expense_id', 'date', 'outlet_name', 'expense_category', 'amount', 'description', 'approval_status', 'approved_by', 'created_at'],
  suppliers: ['supplier_id', 'supplier_name', 'date_order', 'outlet_name', 'total_amount', 'paid_amount', 'unpaid_amount', 'payment_status', 'due_date', 'created_at'],
  summary: ['summary_id', 'date', 'brand_name', 'outlet_name', 'gross_sales', 'net_sales', 'total_expense', 'supplier_cost', 'petty_cash_out', 'unpaid_supplier', 'cash_difference', 'settlement_difference', 'estimated_surplus', 'major_finance_issue', 'created_at'],
};

const TAB: Record<Resource, keyof typeof TABS> = {
  pos: 'posDaily',
  expenses: 'expense',
  suppliers: 'supplierCost',
  summary: 'dailySummary',
};

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'export', 'pos')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const resource = (q.get('resource') ?? '') as Resource;
  if (!RESOURCES.includes(resource)) return badRequest(`resource must be one of: ${RESOURCES.join(', ')}`);
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const outletId = q.get('outlet_id') ?? '';

  const rows = await readTab<Record<string, string>>(TABS[TAB[resource]]);
  let filtered = rows;
  if (from) filtered = filtered.filter((r) => (r.date ?? '') >= from);
  if (to) filtered = filtered.filter((r) => (r.date ?? '') <= to);
  if (outletId) filtered = filtered.filter((r) => r.outlet_id === outletId);

  const csv = toCsv(HEADERS[resource], filtered);
  const filename = `ykp-finance-${resource}-${from || 'all'}-${to || 'all'}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
