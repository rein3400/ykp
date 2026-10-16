import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendPayslipEmail } from './payslip-email';
const config = vi.hoisted(() => ({ host: 'smtp.gmail.com', port: '587', user: 'ykp.erp@gmail.com', pass: 'test-only', secure: 'false', from_name: 'YKP ERP' }));
const send = vi.hoisted(() => vi.fn(async () => ({ messageId: 'test-message' })));
vi.mock('./app-settings', () => ({ getSmtpConfig: async () => config }));
vi.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: send }) }));
beforeEach(() => { send.mockClear(); config.host = 'smtp.gmail.com'; });
describe('central payroll sender', () => {
  it('uses configured SMTP identity, not brand or caller address, and preserves employee recipient', async () => {
    const result = await sendPayslipEmail({ to: 'employee@example.invalid', fromEmail: 'old-brand@example.invalid', fromName: 'Brand', subject: 'Slip', html: 'Slip', text: 'Slip' });
    expect(result.sent).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: 'YKP ERP <ykp.erp@gmail.com>', to: 'employee@example.invalid' }));
  });
  it('does not claim delivery when SMTP is incomplete', async () => {
    config.host = '';
    const result = await sendPayslipEmail({ to: 'employee@example.invalid', fromEmail: 'old@example.invalid', fromName: 'Brand', subject: 'Slip', html: 'Slip', text: 'Slip' });
    expect(result.sent).toBe(false);
    expect(result.mocked).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
