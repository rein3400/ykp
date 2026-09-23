import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const state = vi.hoisted(() => ({
  payroll: {} as Record<string, string>,
  sendMail: vi.fn(async () => ({ messageId: 'synthetic-message-id' })),
  writes: [] as Array<Record<string, string>>
}));

vi.mock('@/db/sheets', () => ({
  TABS: { payroll: 'hr_payroll', employees: 'master_employee' },
  findRow: async (tab: string) => tab === 'hr_payroll'
    ? { rowNumber: 12, row: { ...state.payroll } }
    : { rowNumber: 2, row: { employee_id: 'EMP-SMTP', email: 'employee@example.invalid' } },
  updateRow: async (_tab: string, rowNumber: number, row: Record<string, string>) => {
    expect(rowNumber).toBe(12);
    state.writes.push({ ...row });
    state.payroll = { ...row };
  }
}));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ userId: 'USR-HR', role: 'hr_admin' }) }));
vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }));
vi.mock('@/lib/smtp', () => ({
  smtpConfig: () => ({ host: 'localhost', port: 1025 }),
  sendMail: () => state.sendMail()
}));

/** Invoke the real handler with a valid paid-payroll publishing request. */
function publish(): Promise<Response> {
  return POST(new Request('http://localhost/api/hr/payslip/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payroll_id: 'PR-SMTP' })
  }), { params: Promise.resolve({}) });
}

beforeEach(() => {
  state.payroll = {
    payroll_id: 'PR-SMTP', employee_id: 'EMP-SMTP', employee_name: 'Synthetic Employee',
    payroll_period: '2026-09', payment_status: 'PAID', approval_status: 'APPROVED',
    locked_status: '', updated_at: '2026-09-23 12:00:00', net_salary: '1000000'
  };
  state.writes = [];
  state.sendMail.mockReset();
  state.sendMail.mockResolvedValue({ messageId: 'synthetic-message-id' });
});

describe('payslip delivery preserves changes made during SMTP', () => {
  it('stamps a successful send onto the freshly read payroll row', async () => {
    const started = Promise.withResolvers<void>();
    const complete = Promise.withResolvers<void>();
    state.sendMail.mockImplementation(async () => {
      started.resolve();
      await complete.promise;
      return { messageId: 'synthetic-message-id' };
    });
    const pending = publish();
    await started.promise;
    state.payroll = { ...state.payroll, locked_status: 'LOCKED', updated_at: '2026-09-23 12:01:00' };
    complete.resolve();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(state.writes).toHaveLength(1);
    expect(state.payroll.locked_status).toBe('LOCKED');
    expect(state.payroll.updated_at).toBe('2026-09-23 12:01:00');
    expect(state.payroll.email_sent_status).toBe('SENT');
    expect(state.payroll.email_sent_to).toBe('employee@example.invalid');
  });

  it('also preserves fresh fields when SMTP fails', async () => {
    const started = Promise.withResolvers<void>();
    const complete = Promise.withResolvers<void>();
    state.sendMail.mockImplementation(async () => {
      started.resolve();
      await complete.promise;
      throw new Error('Synthetic SMTP refusal');
    });
    const pending = publish();
    await started.promise;
    state.payroll = { ...state.payroll, locked_status: 'LOCKED', updated_at: '2026-09-23 12:02:00' };
    complete.resolve();
    expect((await pending).status).toBe(502);
    expect(state.payroll.locked_status).toBe('LOCKED');
    expect(state.payroll.updated_at).toBe('2026-09-23 12:02:00');
    expect(state.payroll.email_sent_status).toBe('FAILED');
  });
});
