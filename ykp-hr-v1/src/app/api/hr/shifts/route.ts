/**
 * Shift master CRUD — Owner/HR Admin mengatur jam shift custom.
 * GET    list semua shift (aktif + nonaktif, untuk manajemen)
 * POST   buat shift baru (shift_id auto SH-xxx)
 * PUT    ubah jam/nama/status, atau non-aktifkan (riwayat roster aman)
 *
 * Shift nonaktif tetap tersimpan karena hr_roster & hr_attendance lama
 * mereferensikannya; nonaktif hanya menyembunyikannya dari pilihan roster baru.
 */
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, list, ok, badRequest, unauthorized, forbidden, conflict } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const createSchema = z.object({
  shift_name: z.string().min(2).max(60),
  start_time: z.string().regex(TIME_RE, 'start_time format HH:MM'),
  end_time: z.string().regex(TIME_RE, 'end_time format HH:MM'),
  brand_id: z.string().default(''),
  outlet_id: z.string().default(''),
  break_minutes: z.string().default('60'),
  late_tolerance_minutes: z.string().default('10')
});

const updateSchema = z.object({
  shift_id: z.string().min(1),
  shift_name: z.string().min(2).max(60).optional(),
  start_time: z.string().regex(TIME_RE, 'start_time format HH:MM').optional(),
  end_time: z.string().regex(TIME_RE, 'end_time format HH:MM').optional(),
  break_minutes: z.string().optional(),
  late_tolerance_minutes: z.string().optional(),
  active_status: z.enum(['active', 'inactive']).optional()
});

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'master')) return forbidden();
  return list(await readTab(TABS.shifts));
});

export const POST = handler(async (req) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'master')) return forbidden();

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);
  const d = parsed.data;

  if (d.start_time > d.end_time) {
    return badRequest('Jam selesai harus setelah jam mulai (shift lintas tengah malam tidak didukung).');
  }

  const all = await readTab<Record<string, string>>(TABS.shifts);
  if (
    all.some(
      (r) => (r.active_status ?? 'active') === 'active'
        && r.start_time === d.start_time
        && r.end_time === d.end_time
    )
  ) {
    return conflict(`Shift dengan jam ${d.start_time}-${d.end_time} sudah ada.`);
  }

  let max = 0;
  for (const r of all) {
    const m = (r.shift_id || '').match(/^SH-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const shiftId = `SH-${String(max + 1).padStart(3, '0')}`;
  const now = nowTimestampWib();

  const row: Record<string, string> = {
    shift_id: shiftId,
    shift_name: d.shift_name,
    brand_id: d.brand_id,
    outlet_id: d.outlet_id,
    start_time: d.start_time,
    end_time: d.end_time,
    break_minutes: d.break_minutes,
    late_tolerance_minutes: d.late_tolerance_minutes,
    overtime_rule_id: '',
    active_status: 'active',
    created_at: now,
    status: ''
  };
  await appendRows(TABS.shifts, [row]);

  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'shift',
    entityId: shiftId,
    afterValue: JSON.stringify(row)
  }).catch(() => null);

  return ok(row, 201);
});

export const PUT = handler(async (req) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'master')) return forbidden();

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.shifts, 'shift_id', parsed.data.shift_id);
  if (!found) return badRequest(`Shift tidak ditemukan: ${parsed.data.shift_id}`);

  const start = parsed.data.start_time ?? found.row.start_time;
  const end = parsed.data.end_time ?? found.row.end_time;
  if (start > end) {
    return badRequest('Jam selesai harus setelah jam mulai (shift lintas tengah malam tidak didukung).');
  }

  const updated: Record<string, string> = {
    ...found.row,
    shift_name: parsed.data.shift_name ?? found.row.shift_name,
    start_time: start,
    end_time: end,
    break_minutes: parsed.data.break_minutes ?? found.row.break_minutes,
    late_tolerance_minutes: parsed.data.late_tolerance_minutes ?? found.row.late_tolerance_minutes,
    active_status: parsed.data.active_status ?? found.row.active_status ?? 'active'
  };
  await updateRow(TABS.shifts, found.rowNumber, updated);

  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'update',
    entity: 'shift',
    entityId: parsed.data.shift_id,
    beforeValue: JSON.stringify(found.row),
    afterValue: JSON.stringify(updated)
  }).catch(() => null);

  return ok(updated);
});