/**
 * POST /api/finance/payroll/notify-hr — finance tandai sudah transfer gaji
 * body: { payroll_period: YYYY-MM, brand_id?: string, payroll_ids?: string[] }
 * Proxies to HR finance-notify endpoint or mocks in dev.
 */
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, handler, forbidden } from '@/lib/http';
import { can, type Role } from '@/lib/rbac';
import { isMockMode } from '@/db/mock-store';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'summary')) return forbidden('Forbidden');

  const body = await req.json().catch(() => ({})) as { payroll_period?: string; brand_id?: string; payroll_ids?: string[] };
  const period = (body.payroll_period ?? '').trim();
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return badRequest('payroll_period (YYYY-MM) wajib diisi');

  if (isMockMode() || !process.env.YKP_HR_SPREADSHEET_ID) {
    return ok({ mocked: true, updated: 1, payroll_period: period, brand_id: body.brand_id ?? null });
  }

  const hrUrl = process.env.HR_NOTIFY_URL ?? process.env.YKP_HR_APP_URL ?? 'http://localhost:3002';
  const secret = process.env.FINANCE_NOTIFY_SECRET ?? process.env.HR_NOTIFY_SECRET ?? '';
  const url = `${hrUrl.replace(/\/$/, '')}/api/hr/payroll/finance-notify`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-finance-secret': secret } : {})
      },
      body: JSON.stringify({ payroll_period: period, brand_id: body.brand_id, payroll_ids: body.payroll_ids })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return badRequest(j.error?.message ?? `HR notify gagal: HTTP ${res.status}`);
    return ok(j.data ?? j);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : 'Gagal menghubungi HR');
  }
});