import { readTab, appendRows, TABS, findRow } from '@/db/sheets';
import { assertEmployee, nextSequentialId } from '@/lib/repo';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, list, badRequest, missingRef, unauthorized, forbidden, ok } from '@/lib/http';
import { can } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const insertSchema = z.object({
  employee_id: z.string().min(1),
  adjustment_type: z.enum(['BONUS', 'PENALTY', 'OVERTIME', 'ALLOWANCE', 'CASH_ADVANCE', 'REIMBURSEMENT', 'OTHER']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().min(0),
  reason: z.string().default(''),
  payroll_period: z.string().regex(/^\d{4}-\d{2}$/)
});

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.adjustments);
  return list(rows);
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as any, 'create', 'adjustment')) return forbidden();

  const body = await req.json();
  const parsed = insertSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    await assertEmployee(parsed.data.employee_id);
  } catch (e) {
    return missingRef(e instanceof Error ? e.message : 'Missing ref');
  }

  const id = await nextSequentialId('adjustments', 'adjustment_id', 'ADJ');
  const emp = await findRow(TABS.employees, 'employee_id', parsed.data.employee_id);
  const now = nowTimestampWib();

  const row: Record<string, string> = {
    adjustment_id: id,
    date: parsed.data.date,
    employee_id: parsed.data.employee_id,
    employee_name: emp?.row.full_name ?? '',
    adjustment_type: parsed.data.adjustment_type,
    category: parsed.data.adjustment_type,
    amount: String(parsed.data.amount),
    quantity: '1',
    unit: '',
    reason: parsed.data.reason,
    reference_id: '',
    attachment_url: '',
    approval_status: 'PENDING',
    approved_by: '',
    payroll_period: parsed.data.payroll_period,
    created_by: session.userId,
    created_at: now
  };
  await appendRows(TABS.adjustments, [row]);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'create',
    entity: 'adjustment',
    entityId: id,
    afterValue: JSON.stringify(parsed.data)
  });
  return ok(row, 201);
});