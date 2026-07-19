/**
 * Checklist template master ΓÇö create + activate/deactivate.
 * owner/super_admin only (brief ┬º10: template change wajib approval).
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, forbidden, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { DEPARTMENTS } from '@/lib/constants';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner' && s.role !== 'super_admin') {
    return forbidden('Perubahan template membutuhkan owner / super_admin');
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.checklist_item?.trim()) return badRequest('checklist_item wajib diisi');
  if (!['OPENING', 'CLOSING'].includes(body.checklist_type ?? '')) return badRequest('checklist_type harus OPENING / CLOSING');
  if (!(DEPARTMENTS as readonly string[]).includes(body.department ?? '')) return badRequest('department tidak valid');

  const now = nowTimestampWib();
  const id = nextSequentialIdSync('TPL');
  const row: Record<string, string> = {
    checklist_template_id: id,
    brand_id: body.brand_id ?? '',
    outlet_id: body.outlet_id ?? '',
    checklist_type: body.checklist_type,
    department: body.department,
    checklist_item: body.checklist_item,
    checklist_category: body.checklist_category ?? '',
    required_photo: body.required_photo === 'YES' ? 'YES' : 'NO',
    target_value: body.target_value ?? '',
    tolerance_value: body.tolerance_value ?? '',
    unit: body.unit ?? '',
    critical_flag: body.critical_flag === 'YES' ? 'YES' : 'NO',
    active_status: 'active',
    created_at: now,
    updated_at: now
  };
  await appendRows(TABS.checklistTemplate, [row]);
  await logAudit({ module: 'ops', action: 'create', recordType: 'master_checklist_template', recordId: id, afterValue: JSON.stringify(row), userId: s.userId, approvalUserId: s.userId }).catch(() => null);
  return ok(row, 201);
});

export const PATCH = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner' && s.role !== 'super_admin') {
    return forbidden('Perubahan template membutuhkan owner / super_admin');
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.checklist_template_id) return badRequest('checklist_template_id wajib diisi');
  const found = await findRow(TABS.checklistTemplate, 'checklist_template_id', body.checklist_template_id);
  if (!found) return notFound('Template tidak ditemukan');
  const before = { ...found.row };
  const updated = { ...found.row };
  for (const k of ['checklist_item', 'checklist_category', 'required_photo', 'target_value', 'tolerance_value', 'unit', 'critical_flag', 'active_status']) {
    if (body[k] !== undefined) updated[k] = body[k];
  }
  updated.updated_at = nowTimestampWib();

  await updateRow(TABS.checklistTemplate, found.rowNumber, updated);
  await logAudit({
    module: 'ops', action: 'template_change', recordType: 'master_checklist_template', recordId: body.checklist_template_id,
    beforeValue: JSON.stringify(before), afterValue: JSON.stringify(updated), userId: s.userId, approvalUserId: s.userId
  }).catch(() => null);
  return ok(updated);
});

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = await readTab<Record<string, string>>(TABS.checklistTemplate);
  return ok({ items: rows, total_items: rows.length });
});
