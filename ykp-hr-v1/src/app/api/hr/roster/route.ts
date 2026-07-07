import { readTab, appendRows, TABS, findRow } from '@/db/sheets';
import { assertEmployee, assertShift, nextSequentialId } from '@/lib/repo';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, list, badRequest, missingRef, unauthorized, forbidden, ok } from '@/lib/http';
import { can } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const insertSchema = z.object({
  employee_id: z.string().min(1),
  shift_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roster_status: z.string().default('SCHEDULED'),
  notes: z.string().default('')
});

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.roster);
  return list(rows);
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as any, 'create', 'roster')) return forbidden();

  const body = await req.json();
  const parsed = insertSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    await assertEmployee(parsed.data.employee_id);
    await assertShift(parsed.data.shift_id);
  } catch (e) {
    return missingRef(e instanceof Error ? e.message : 'Missing ref');
  }

  const emp = await findRow(TABS.employees, 'employee_id', parsed.data.employee_id);
  const shift = await findRow(TABS.shifts, 'shift_id', parsed.data.shift_id);
  const id = await nextSequentialId('roster', 'roster_id', 'RS');
  const now = nowTimestampWib();

  const row: Record<string, string> = {
    roster_id: id,
    date: parsed.data.date,
    employee_id: parsed.data.employee_id,
    employee_name: emp?.row.full_name ?? '',
    brand_id: emp?.row.brand_id ?? '',
    outlet_id: emp?.row.outlet_id ?? '',
    shift_id: parsed.data.shift_id,
    role: emp?.row.role ?? '',
    roster_status: parsed.data.roster_status,
    replacement_employee_id: '',
    swap_request_id: '',
    approved_by: '',
    notes: parsed.data.notes,
    created_at: now
  };
  await appendRows(TABS.roster, [row]);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'create',
    entity: 'roster',
    entityId: id,
    afterValue: JSON.stringify(parsed.data)
  });
  return ok(row, 201);
});