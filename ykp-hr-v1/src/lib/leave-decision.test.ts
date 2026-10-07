import { describe, expect, it } from 'vitest';
import { leaveDecisionReason, formatTelegramLeave } from './leave-decision';

describe('leave decision explanation', () => {
  it('rejects whitespace-only reason and clears stale reason on approval', () => {
    expect(() => leaveDecisionReason('REJECT', '  ')).toThrow();
    expect(leaveDecisionReason('REJECT', '  Jadwal padat  ')).toBe('Jadwal padat');
    expect(leaveDecisionReason('APPROVE', 'old rejection')).toBe('');
  });
  it('renders rejected reasons without Telegram HTML injection', () => {
    expect(formatTelegramLeave({ leave_type: 'SICK', start_date: '2026-10-07', end_date: '2026-10-08', approval_status: 'REJECTED', rejection_reason: '<b>Lengkapi & surat</b>' })).toContain('Alasan: &lt;b&gt;Lengkapi &amp; surat&lt;/b&gt;');
    expect(formatTelegramLeave({ approval_status: 'APPROVED', rejection_reason: 'old rejection' })).not.toContain('old rejection');
  });
});
