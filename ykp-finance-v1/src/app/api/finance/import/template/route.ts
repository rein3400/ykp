/**
 * GET /api/finance/import/template?type=pos|items
 * Downloads a CSV template for Moka POS import. RBAC: import action.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { can, type Role } from '@/lib/rbac';
import { toCsvRaw } from '@/lib/csv';

const TEMPLATES: Record<string, { filename: string; headers: string[] }> = {
  pos: {
    filename: 'ykp-moka-pos-template.csv',
    headers: ['date', 'outlet', 'brand', 'gross_sales', 'net_sales', 'discount', 'refund', 'void', 'tax', 'service_charge', 'payment_method', 'transaction_count', 'shift'],
  },
  items: {
    filename: 'ykp-moka-items-template.csv',
    headers: ['date', 'outlet', 'brand', 'item', 'sku', 'category', 'qty', 'gross_sales', 'discount', 'refund', 'net_sales'],
  },
};

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'import', 'pos')) return forbidden('Forbidden');

  const type = req.nextUrl.searchParams.get('type') ?? 'pos';
  const t = TEMPLATES[type];
  if (!t) return badRequest('type must be: pos | items');

  const csv = toCsvRaw([t.headers, t.headers.map(() => '')]);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${t.filename}"`,
    },
  });
});
