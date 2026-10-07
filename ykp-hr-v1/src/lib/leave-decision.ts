export function leaveDecisionReason(decision: 'APPROVE' | 'REJECT', reason: string): string {
  if (decision === 'APPROVE') return '';
  const trimmed = reason.trim();
  if (!trimmed) throw new Error('Alasan penolakan cuti wajib diisi');
  return trimmed;
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatTelegramLeave(leave: Record<string, string>): string {
  const line = `• ${escape(leave.leave_type ?? '-')} ${escape(leave.start_date ?? '-')}–${escape(leave.end_date ?? '-')} (${escape(leave.approval_status || '-')})`;
  return leave.approval_status === 'REJECTED' && leave.rejection_reason?.trim()
    ? `${line}\n  Alasan: ${escape(leave.rejection_reason.trim())}`
    : line;
}
