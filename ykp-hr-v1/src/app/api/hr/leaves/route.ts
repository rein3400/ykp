import { readTab, appendRows, TABS, findRow } from '@/db/sheets';
import { assertEmployee, nextSequentialId } from '@/lib/repo';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, list, badRequest, missingRef, unauthorized, forbidden, ok } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const insertSchema = z.object({
  employee_id: z.string().min(1),
  leave_type: z.enum(['ANNUAL_LEAVE', 'SICK', 'PERMISSION', 'UNPAID_LEAVE', 'EMERGENCY', 'MATERNITY', 'OTHER']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().default('')
});

function daysBetween(a: string, b: string): number {
  const s = new Date(a + 'T00:00:00Z').getTime();
  const e = new Date(b + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round((e - s) / 86400000) + 1);
}

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.leaves);
  return list(rows);
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'create', 'leave')) return forbidden();

  const body = await req.json();
  const parsed = insertSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    await assertEmployee(parsed.data.employee_id);
  } catch (e) {
    return missingRef(e instanceof Error ? e.message : 'Missing ref');
  }

  const days = daysBetween(parsed.data.start_date, parsed.data.end_date);
  const leaveId = await nextSequentialId('leaves', 'leave_id', 'LV');
  const emp = await findRow(TABS.employees, 'employee_id', parsed.data.employee_id);
  const now = nowTimestampWib();

  const row: Record<string, string> = {
    leave_id: leaveId,
    employee_id: parsed.data.employee_id,
    employee_name: emp?.row.full_name ?? '',
    leave_type: parsed.data.leave_type,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    total_days: String(days),
    reason: parsed.data.reason,
    attachment_url: '',
    submitted_at: now,
    approval_status: 'PENDING',
    approved_by: '',
    approved_at: '',
    rejection_reason: '',
    notes: '',
    created_at: now
  };

  await appendRows(TABS.leaves, [row]);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'create',
    entity: 'leave',
    entityId: leaveId
  });
  return ok(row, 201);
});
