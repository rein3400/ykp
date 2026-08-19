/**
 * POST /api/hr/telegram/leave
 * Bot-authenticated (x-bot-secret header, shared with the Hermez service).
 * Submits a leave request for the linked user.
 */
import { readTab, appendRows, findRow, TABS } from '@/db/sheets';
import { assertEmployee, nextSequentialId } from '@/lib/repo';
import { handler, badRequest, unauthorized, ok, notFound } from '@/lib/http';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({
  telegram_chat_id: z.string().min(1),
  leave_type: z.enum(['ANNUAL_LEAVE', 'SICK', 'PERMISSION', 'UNPAID_LEAVE', 'EMERGENCY', 'MATERNITY', 'OTHER']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().default(''),
});

function botAuthorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-bot-secret') ?? '';
  return header === secret;
}

function daysBetween(a: string, b: string): number {
  const s = new Date(a + 'T00:00:00Z').getTime();
  const e = new Date(b + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round((e - s) / 86400000) + 1);
}

export const POST = handler(async (req) => {
  if (!botAuthorized(req)) return unauthorized('Invalid or missing x-bot-secret');
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const users = await readTab<Record<string, string>>(TABS.users).catch(() => []);
  const user = users.find((u) => u.telegram_id === parsed.data.telegram_chat_id && (u.active_status || 'active') === 'active');
  if (!user) return notFound('Telegram belum dihubungkan ke akun. Ketik /link KODE untuk menghubungkan.');

  const employeeId = user.employee_id;
  if (!employeeId) return badRequest('Akun kamu belum terhubung ke data karyawan. Hubungi admin HR.');

  try {
    await assertEmployee(employeeId);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : 'Missing ref');
  }

  const days = daysBetween(parsed.data.start_date, parsed.data.end_date);
  const leaveId = await nextSequentialId('leaves', 'leave_id', 'LV');
  const emp = await findRow(TABS.employees, 'employee_id', employeeId);
  const now = nowTimestampWib();

  const row: Record<string, string> = {
    leave_id: leaveId,
    employee_id: employeeId,
    employee_name: emp?.row.full_name ?? '',
    leave_type: parsed.data.leave_type,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    total_days: String(days),
    reason: parsed.data.reason,
    attachment_url: '',
    doctor_letter_url: '',
    submitted_at: now,
    approval_status: 'PENDING',
    approved_by: '',
    approved_at: '',
    rejection_reason: '',
    notes: 'diajukan via telegram',
    created_at: now
  };

  await appendRows(TABS.leaves, [row]);
  return ok({ leave_id: leaveId, total_days: String(days), approval_status: 'PENDING' }, 201);
});
