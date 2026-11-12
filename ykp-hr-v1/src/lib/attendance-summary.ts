import { normalizeShiftTime } from './shift-time';
import { escapeHtml } from './telegram-attendance';
function time(raw: string | undefined, empty: string): string {
  if (!raw?.trim()) return empty;
  try { return `${normalizeShiftTime(raw)} WIB`; }
  catch { return 'format jam tidak valid; hubungi HR'; }
}
export function attendanceSummaryLines(row: Record<string, string>): string[] {
  const status = row.attendance_status || row.status || '';
  const labels: Record<string, string> = { PRESENT: 'HADIR', LATE: 'TERLAMBAT', ABSENT: 'TIDAK HADIR', LEAVE: 'CUTI', SICK: 'SAKIT' };
  return [
    `• Check-in: ${time(row.actual_check_in, 'belum absen masuk')} (jadwal ${time(row.scheduled_check_in, 'belum ditetapkan')})`,
    `• Check-out: ${time(row.actual_check_out, 'belum absen pulang')} (jadwal ${time(row.scheduled_check_out, 'belum ditetapkan')})`,
    `• Status: ${escapeHtml(labels[status] || status || 'belum tersedia')}`
  ];
}
