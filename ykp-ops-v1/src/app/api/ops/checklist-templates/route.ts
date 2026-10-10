import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { appendRows, findRow, readTab, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { handler, ok, list, unauthorized, forbidden, badRequest, fail, notFound } from '@/lib/http';
import { logAudit } from '@/lib/audit';

const createSchema = z.object({
  outlet_id: z.string().trim().min(1),
  checklist_type: z.enum(['OPENING', 'CLOSING', 'GENERAL']),
  department: z.string().trim().min(1).max(150).default('Umum'),
  checklist_item: z.string().trim().min(1).max(2000),
  required_photo: z.enum(['true', 'false']).default('false'),
  critical_flag: z.enum(['true', 'false']).default('false'),
  target_value: z.string().trim().max(200).default(''),
  tolerance_value: z.string().trim().max(200).default('')
});
const activationSchema = z.object({
  checklist_template_id: z.string().trim().min(1), active_status: z.enum(['active', 'inactive'])
});

export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'view', 'master')) return forbidden();
  const rows = await readTab(TABS.checklistTemplates);
  return list(rows.filter((row) => (!session.brandId || !row.brand_id || row.brand_id === session.brandId) && (!session.outletId || !row.outlet_id || row.outlet_id === session.outletId)));
});

export const POST = handler(async (request) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'create', 'master')) return forbidden();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Template tidak valid');
  const outlet = await findRow(TABS.outlets, 'outlet_id', parsed.data.outlet_id);
  if (!outlet || !['active', '1'].includes((outlet.row.status ?? '').trim().toLowerCase())) return badRequest('Outlet tidak aktif atau tidak ditemukan');
  if (session.outletId && session.outletId !== parsed.data.outlet_id) return forbidden();
  if (session.brandId && session.brandId !== outlet.row.brand_id) return forbidden();
  const existing = await readTab(TABS.checklistTemplates);
  if (existing.some((row) => row.outlet_id === parsed.data.outlet_id && row.checklist_type === parsed.data.checklist_type && row.department === parsed.data.department && row.checklist_item === parsed.data.checklist_item && row.active_status === 'active')) return fail('conflict', 'Template aktif yang sama sudah ada', 409);
  const row = { ...parsed.data, brand_id: outlet.row.brand_id, checklist_template_id: `CT-${randomUUID()}`, active_status: 'active' };
  await appendRows(TABS.checklistTemplates, [row]);
  await logAudit({ actorUserId: session.userId, actorRole: session.role, action: 'create', entity: 'checklist_template', entityId: row.checklist_template_id, afterValue: JSON.stringify(row) });
  return ok(row, 201);
});

export const PUT = handler(async (request) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'update', 'master')) return forbidden();
  const parsed = activationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('ID dan status template wajib valid');
  const found = await findRow(TABS.checklistTemplates, 'checklist_template_id', parsed.data.checklist_template_id);
  if (!found) return notFound('Template tidak ditemukan');
  if (session.outletId && session.outletId !== found.row.outlet_id) return forbidden();
  if (session.brandId && session.brandId !== found.row.brand_id) return forbidden();
  const row = { ...found.row, active_status: parsed.data.active_status };
  await updateRow(TABS.checklistTemplates, found.rowIndex, row);
  await logAudit({ actorUserId: session.userId, actorRole: session.role, action: 'update', entity: 'checklist_template', entityId: parsed.data.checklist_template_id, beforeValue: JSON.stringify(found.row), afterValue: JSON.stringify(row) });
  return ok(row);
});
