/**
 * POST /api/finance/payroll/needs-revision — Finance minta revisi nominal gaji.
 * body: { payroll_id: string, reason: string (wajib, min 5 karakter) }
 *
 * Finance TIDAK menulis tab HR secara langsung (invariant cross-domain
 * read-only); request diteruskan ke HR `/api/hr/payroll/needs-revision`
 * dengan header `x-finance-secret`, lalu dicatat di audit Finance.
 */
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, fail, handler, forbidden } from '@/lib/http';
import { canApprove, type Role } from '@/lib/rbac';
import { isMockMode } from '@/db/mock-store';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const schema = z.object({
  payroll_id: z.string().min(1, 'payroll_id wajib diisi'),
  reason: z.string().trim().min(5, 'Alasan revisi wajib diisi (min 5 karakter)').max(500)
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!canApprove(s.role as Role)) return forbidden('Hanya owner/super_admin/finance_admin yang dapat meminta revisi');

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  if (isMockMode() || !process.env.YKP_HR_SPREADSHEET_ID) {
    await logAudit({
      module: 'finance',
      action: 'request_revision',
      recordType: 'payroll',
      recordId: parsed.data.payroll_id,
      reason: parsed.data.reason,
      userId: s.userId
    });
    return ok({ mocked: true, payroll_id: parsed.data.payroll_id });
  }

  const hrUrl = process.env.HR_NOTIFY_URL ?? process.env.YKP_HR_APP_URL ?? 'http://localhost:3002';
  const secret = process.env.FINANCE_NOTIFY_SECRET ?? process.env.HR_NOTIFY_SECRET ?? '';
  const url = `${hrUrl.replace(/\/$/, '')}/api/hr/payroll/needs-revision`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-finance-secret': secret } : {})
      },
      body: JSON.stringify(parsed.data)
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = j.error?.message ?? `HR menolak permintaan revisi: HTTP ${res.status}`;
      if (res.status === 401) return unauthorized(`HR menolak kredensial service (${message})`);
      if (res.status === 403) return forbidden(message);
      if (res.status === 404) return fail('not_found', 'Endpoint needs-revision tidak ditemukan di aplikasi HR — deploy HR belum memuat fitur ini', 404);
      if (res.status === 409) return fail('conflict', message, 409);
      return badRequest(message);
    }
    await logAudit({
      module: 'finance',
      action: 'request_revision',
      recordType: 'payroll',
      recordId: parsed.data.payroll_id,
      reason: parsed.data.reason,
      userId: s.userId
    });
    return ok(j.data ?? j);
  } catch (e) {
    return fail('upstream_unreachable', `Tidak bisa menghubungi HR: ${e instanceof Error ? e.message : 'unknown'}`, 502);
  }
});
