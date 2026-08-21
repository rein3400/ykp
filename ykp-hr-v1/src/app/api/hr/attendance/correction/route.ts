/**
 * Attendance correction request + approval (revisi item 18).
 * Staff request correction (wrong clock-in/out, incomplete) → supervisor approve.
 */
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, ok, list, badRequest, unauthorized, forbidden, notFound } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialId } from '@/lib/repo';

export const GET = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  let rows: Record<string, string>[] = [];
  try {
    rows = await readTab<Record<string, string>>('attendance_correction' as never);
  } catch {
    // fall through empty if tab missing — store in audit as fallback not ideal;
    // use attendance rows with correction fields
    const att = await readTab<Record<string, string>>(TABS.attendance);
    rows = att.filter((a) => a.correction_status && a.correction_status !== '');
  }
  if (status) rows = rows.filter((r) => r.correction_status === status || r.status === status);
  return list(rows);
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as {
    attendance_id: string;
    correction_type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BOTH' | 'STATUS' | 'OTHER';
    corrected_clock_in?: string;
    corrected_clock_out?: string;
    corrected_status?: string;
    reason: string;
    photo_url?: string;
    latitude?: string;
    longitude?: string;
  };

  if (!body.attendance_id) return badRequest('attendance_id required');
  if (!body.reason) return badRequest('reason required');
  if (!body.correction_type) return badRequest('correction_type required');

  const found = await findRow(TABS.attendance, 'attendance_id', body.attendance_id);
  if (!found) return notFound('Attendance record not found');

  // Staff can only correct own attendance (unless manager+)
  const isManager = can(session.role as Role, 'approve', 'attendance') ||
    can(session.role as Role, 'update', 'attendance');
  if (!isManager) {
    if (session.employeeId !== found.row.employee_id) {
      return forbidden('Hanya bisa koreksi absen sendiri');
    }
  }

  const now = nowTimestampWib();
  const correctionId = await nextSequentialId('attendance', 'attendance_id', 'ACR').catch(
    () => `ACR-${Date.now().toString(36).toUpperCase()}`
  );

  // Store correction request on the attendance row
  const updated = {
    ...found.row,
    correction_id: correctionId,
    correction_status: 'PENDING',
    correction_type: body.correction_type,
    correction_reason: body.reason,
    corrected_clock_in: body.corrected_clock_in || '',
    corrected_clock_out: body.corrected_clock_out || '',
    corrected_status: body.corrected_status || '',
    correction_photo_url: body.photo_url || '',
    correction_latitude: body.latitude || '',
    correction_longitude: body.longitude || '',
    correction_requested_by: session.userId,
    correction_requested_at: now,
    correction_approved_by: '',
    correction_approved_at: ''
  };
  await updateRow(TABS.attendance, found.rowNumber, updated);

  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'create',
    entity: 'attendance_correction',
    entityId: correctionId,
    beforeValue: JSON.stringify({
      actual_check_in: found.row.actual_check_in,
      actual_check_out: found.row.actual_check_out,
      attendance_status: found.row.attendance_status
    }),
    afterValue: JSON.stringify(body),
    reason: body.reason
  });

  return ok({
    ...body,
    correction_id: correctionId,
    attendance_id: body.attendance_id,
    status: 'PENDING'
  }, 201);
});

export const PUT = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'approve', 'attendance') && !can(session.role as Role, 'update', 'attendance')) {
    return forbidden();
  }

  const body = (await req.json().catch(() => ({}))) as {
    attendance_id: string;
    action: 'approve' | 'reject';
    reason?: string;
  };
  if (!body.attendance_id || !body.action) return badRequest('attendance_id and action required');

  const found = await findRow(TABS.attendance, 'attendance_id', body.attendance_id);
  if (!found) return notFound('Attendance not found');
  if (found.row.correction_status !== 'PENDING') {
    return badRequest(`Correction not pending (status: ${found.row.correction_status || 'none'})`);
  }

  const now = nowTimestampWib();

  if (body.action === 'reject') {
    const updated = {
      ...found.row,
      correction_status: 'REJECTED',
      correction_approved_by: session.userId,
      correction_approved_at: now
    };
    await updateRow(TABS.attendance, found.rowNumber, updated);
    await logAudit({
      actorUserId: session.userId, actorRole: session.role,
      action: 'reject', entity: 'attendance_correction',
      entityId: found.row.correction_id || body.attendance_id,
      reason: body.reason || ''
    });
    return ok({ attendance_id: body.attendance_id, status: 'REJECTED' });
  }

  // Approve: apply corrected values to the attendance row.
  // Attendance headers are actual_check_in / actual_check_out /
  // attendance_status / check_in_photo_url / check_out_photo_url / latitude /
  // longitude — NOT clock_in/clock_out/photo_url/status. Writing the wrong
  // names silently lost corrections.
  const ctype = (found.row.correction_type ?? 'BOTH').toUpperCase();
  const updated = {
    ...found.row,
    actual_check_in:
      ctype === 'CLOCK_IN' || ctype === 'BOTH'
        ? found.row.corrected_clock_in || found.row.actual_check_in
        : found.row.actual_check_in,
    actual_check_out:
      ctype === 'CLOCK_OUT' || ctype === 'BOTH'
        ? found.row.corrected_clock_out || found.row.actual_check_out
        : found.row.actual_check_out,
    attendance_status: found.row.corrected_status || found.row.attendance_status,
    check_in_photo_url: found.row.correction_photo_url || found.row.check_in_photo_url || '',
    check_out_photo_url: found.row.correction_photo_url || found.row.check_out_photo_url || '',
    latitude: found.row.correction_latitude || found.row.latitude || '',
    longitude: found.row.correction_longitude || found.row.longitude || '',
    correction_status: 'APPROVED',
    correction_approved_by: session.userId,
    correction_approved_at: now
  };
  await updateRow(TABS.attendance, found.rowNumber, updated);

  await logAudit({
    actorUserId: session.userId, actorRole: session.role,
    action: 'approve', entity: 'attendance_correction',
    entityId: found.row.correction_id || body.attendance_id,
    beforeValue: JSON.stringify({
      actual_check_in: found.row.actual_check_in,
      actual_check_out: found.row.actual_check_out,
      attendance_status: found.row.attendance_status
    }),
    afterValue: JSON.stringify({
      actual_check_in: updated.actual_check_in,
      actual_check_out: updated.actual_check_out,
      attendance_status: updated.attendance_status
    }),
    reason: body.reason || found.row.correction_reason || ''
  });

  return ok({ attendance_id: body.attendance_id, status: 'APPROVED', applied: true });
});
