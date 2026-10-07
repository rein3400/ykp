import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, list, unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { createHash } from 'node:crypto';
import { todayWib, nowTimestampWib } from '@/lib/format';
import { selectChecklistTemplates, validateChecklistSubmission } from '@/lib/checklist';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'closing')) return forbidden();
  return list(await readTab(TABS.closing));
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'closing')) return forbidden();
  const body = (await req.json().catch(() => ({}))) as { outlet_id: string; shift_id: string; date?: string; items?: Record<string, string>[] };
  if (!body.outlet_id) return badRequest('outlet_id required');
  const outlet = await findRow(TABS.outlets, 'outlet_id', body.outlet_id);
  if (!outlet) return badRequest('outlet not found');
  if (!['active', '1'].includes((outlet.row.status ?? '').trim().toLowerCase())) return badRequest('Outlet tidak aktif');
  if (s.outletId && s.outletId !== body.outlet_id) return forbidden();
  if (s.brandId && s.brandId !== outlet.row.brand_id) return forbidden();
  if (!body.shift_id || !(await findRow(TABS.shifts, 'shift_id', body.shift_id))) return badRequest('Shift tidak valid');
  if (body.date && body.date !== todayWib()) return badRequest('Tanggal berubah; refresh halaman sebelum submit');
  if (!Array.isArray(body.items) || body.items.some((item) => !item || typeof item.checklist_item !== 'string' || typeof item.status !== 'string')) return badRequest('Checklist wajib diisi');
  const templates = selectChecklistTemplates(await readTab(TABS.checklistTemplates), 'CLOSING', body.outlet_id, outlet.row.brand_id);
  let validated: ReturnType<typeof validateChecklistSubmission>;
  try { validated = validateChecklistSubmission(templates, body.items); }
  catch (error) { return badRequest(error instanceof Error ? error.message : 'Checklist tidak valid'); }
  const id = `CLS-${createHash('sha256').update(JSON.stringify([todayWib(), body.outlet_id, body.shift_id, s.userId, validated.items])).digest('hex').slice(0, 24)}`;
  const completed = await findRow(TABS.closing, 'closing_id', id);
  if (completed) return ok(completed.row);
  const row = {
    closing_id: id,
    date: todayWib(),
    brand_id: outlet.row.brand_id,
    outlet_id: body.outlet_id,
    shift_id: body.shift_id ?? '',
    expected_cash: '',
    actual_cash: '',
    cash_difference: '',
    checklist_status: validated.status === 'CLOSED' ? 'DONE' : 'NOT_DONE',
    issues: validated.items.filter((item) => item.status !== 'DONE').map((item) => item.checklist_item).join('; '),
    photo_url: '',
    closed_by: s.userId,
    approved_by: '',
    status: validated.status,
    created_at: nowTimestampWib(),
  };
  const existingDetails = new Set((await readTab(TABS.checklistSubmissions)).map((detail) => detail.submission_id));
  const missingDetails = validated.items.map((item, index) => ({
    ...item, submission_id: `${id}-${index + 1}`, date: row.date, brand_id: row.brand_id,
    outlet_id: row.outlet_id, shift_id: row.shift_id, checklist_type: 'CLOSING',
    submitted_by: s.userId, submitted_at: row.created_at
  })).filter((detail) => !existingDetails.has(detail.submission_id));
  if (missingDetails.length) await appendRows(TABS.checklistSubmissions, missingDetails);
  await appendRows(TABS.closing, [row]);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'closing',
    entityId: id,
    afterValue: JSON.stringify(row),
  }).catch(() => null);
  return ok(row, 201);
});
