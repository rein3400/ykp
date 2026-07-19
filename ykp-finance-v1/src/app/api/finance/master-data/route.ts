/**
 * Master data: brands, outlets, suppliers, expense categories, payment methods,
 * petty-cash accounts. GET returns all in one payload (filters + forms).
 * POST creates a row in the matching tab (entity field), RBAC finance_admin+.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialId } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const [brands, outlets, suppliers, expenseCategories, paymentMethods, pettyCashAccounts, thresholds] = await Promise.all([
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.suppliers),
    readTab<Record<string, string>>(TABS.expenseCategories),
    readTab<Record<string, string>>(TABS.paymentMethods),
    readTab<Record<string, string>>(TABS.pettyCashAccounts),
    readTab<Record<string, string>>(TABS.thresholdConfig)
  ]);
  return ok({ brands, outlets, suppliers, expenseCategories, paymentMethods, pettyCashAccounts, thresholds });
});

type Entity = 'brand' | 'outlet' | 'supplier' | 'expense_category' | 'payment_method' | 'petty_cash_account';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'master')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const entity = (body.entity ?? '') as Entity;
  const t = nowTimestampWib();

  let row: Record<string, string>;
  switch (entity) {
    case 'brand': {
      if (!body.brand_name) return badRequest('brand_name is required');
      const id = await nextSequentialId('brands', 'brand_id', 'BR');
      row = { brand_id: id, brand_name: body.brand_name, brand_code: body.brand_code ?? '', status: 'active', created_at: t, updated_at: t };
      await appendRows(TABS.brands, [row]);
      break;
    }
    case 'outlet': {
      if (!body.outlet_name || !body.brand_id) return badRequest('outlet_name and brand_id are required');
      const id = await nextSequentialId('outlets', 'outlet_id', 'OL');
      row = { outlet_id: id, brand_id: body.brand_id, outlet_name: body.outlet_name, outlet_code: body.outlet_code ?? '', address: body.address ?? '', status: 'active', created_at: t, updated_at: t };
      await appendRows(TABS.outlets, [row]);
      break;
    }
    case 'supplier': {
      if (!body.supplier_name) return badRequest('supplier_name is required');
      const id = await nextSequentialId('suppliers', 'supplier_id', 'SUP');
      row = {
        supplier_id: id, supplier_name: body.supplier_name, category: body.category ?? '',
        phone: body.phone ?? '', bank_name: body.bank_name ?? '', bank_account: body.bank_account ?? '',
        account_holder: body.account_holder ?? '', status: 'active', created_at: t, updated_at: t
      };
      await appendRows(TABS.suppliers, [row]);
      break;
    }
    case 'expense_category': {
      if (!body.category_name) return badRequest('category_name is required');
      const id = await nextSequentialId('expenseCategories', 'category_id', 'CAT');
      row = { category_id: id, category_name: body.category_name, account_type: body.account_type ?? 'OPEX', status: 'active', created_at: t };
      await appendRows(TABS.expenseCategories, [row]);
      break;
    }
    case 'payment_method': {
      if (!body.method_name) return badRequest('method_name is required');
      const id = await nextSequentialId('paymentMethods', 'method_id', 'PM');
      row = { method_id: id, method_name: body.method_name, type: body.type ?? '', is_cash: body.is_cash === 'true' ? 'true' : 'false', status: 'active', created_at: t };
      await appendRows(TABS.paymentMethods, [row]);
      break;
    }
    case 'petty_cash_account': {
      if (!body.account_name || !body.outlet_id) return badRequest('account_name and outlet_id are required');
      const id = await nextSequentialId('pettyCashAccounts', 'account_id', 'PCA');
      row = {
        account_id: id, outlet_id: body.outlet_id, brand_id: body.brand_id ?? '',
        account_name: body.account_name, opening_balance: body.opening_balance ?? '0',
        daily_limit: body.daily_limit ?? '500000', currency: 'IDR', status: 'active', created_at: t
      };
      await appendRows(TABS.pettyCashAccounts, [row]);
      break;
    }
    default:
      return badRequest(`unknown entity: ${entity}`);
  }

  await logAudit({
    module: 'finance', action: 'create', recordType: `master_${entity}`,
    recordId: Object.values(row)[0] ?? '', afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
