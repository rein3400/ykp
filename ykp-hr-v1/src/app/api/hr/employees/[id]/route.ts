import { findRow, updateRow, TABS } from '@/db/sheets';
import { assertBrand, assertOutlet } from '@/lib/repo';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, missingRef, notFound, unauthorized, forbidden, ok } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const updateSchema = z.object({
  full_name: z.string().min(1).optional(),
  nickname: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: z.string().optional(),
  position: z.string().optional(),
  brand_id: z.string().min(1).optional(),
  outlet_id: z.string().min(1).optional(),
  basic_salary: z.coerce.number().min(0).optional(),
  salary_type: z.string().optional(),
  employment_status: z.string().optional(),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
  account_holder: z.string().optional()
});

export const GET = handler(async (_req, ctx) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'view', 'employee')) return forbidden();

  const id = ctx?.params?.id;
  if (!id) return badRequest('id required');

  const found = await findRow(TABS.employees, 'employee_id', id);
  if (!found) return notFound('employee not found');
  return ok(found.row);
});

export const PUT = handler(async (req, ctx) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'update', 'employee')) return forbidden();

  const id = ctx?.params?.id;
  if (!id) return badRequest('id required');

  const found = await findRow(TABS.employees, 'employee_id', id);
  if (!found) return notFound('employee not found');

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  if (parsed.data.brand_id || parsed.data.outlet_id) {
    try {
      if (parsed.data.brand_id) await assertBrand(parsed.data.brand_id);
      if (parsed.data.outlet_id) await assertOutlet(parsed.data.outlet_id);
    } catch (e) {
      return missingRef(e instanceof Error ? e.message : 'Missing ref');
    }
  }

  const now = nowTimestampWib();
  const before = { ...found.row };
  const merged: Record<string, string> = {
    ...found.row,
    ...(parsed.data.full_name !== undefined ? { full_name: parsed.data.full_name } : {}),
    ...(parsed.data.nickname !== undefined ? { nickname: parsed.data.nickname } : {}),
    ...(parsed.data.gender !== undefined ? { gender: parsed.data.gender } : {}),
    ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
    ...(parsed.data.email !== undefined ? { email: parsed.data.email ?? '' } : {}),
    ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
    ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
    ...(parsed.data.brand_id !== undefined ? { brand_id: parsed.data.brand_id } : {}),
    ...(parsed.data.outlet_id !== undefined ? { outlet_id: parsed.data.outlet_id } : {}),
    ...(parsed.data.basic_salary !== undefined ? { basic_salary: String(parsed.data.basic_salary) } : {}),
    ...(parsed.data.salary_type !== undefined ? { salary_type: parsed.data.salary_type } : {}),
    ...(parsed.data.employment_status !== undefined ? { employment_status: parsed.data.employment_status } : {}),
    ...(parsed.data.join_date !== undefined ? { join_date: parsed.data.join_date } : {}),
    ...(parsed.data.bank_name !== undefined ? { bank_name: parsed.data.bank_name } : {}),
    ...(parsed.data.bank_account !== undefined ? { bank_account: parsed.data.bank_account } : {}),
    ...(parsed.data.account_holder !== undefined ? { account_holder: parsed.data.account_holder } : {}),
    updated_at: now,
    updated_by: session.userId
  };

  await updateRow(TABS.employees, found.rowNumber, merged);

  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'update',
    entity: 'employee',
    entityId: id,
    beforeValue: JSON.stringify(pickChanges(before, merged)),
    afterValue: JSON.stringify(parsed.data)
  });

  return ok(merged);
});

function pickChanges(before: Record<string, string>, after: Record<string, string>) {
  const out: Record<string, { from: string; to: string }> = {};
  for (const k of Object.keys(after)) {
    if (before[k] !== after[k]) out[k] = { from: before[k] ?? '', to: after[k] ?? '' };
  }
  return out;
}