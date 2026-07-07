/**
 * Generate a minimal text-based payslip for download.
 * Plain text only (PDF generator without extra deps). Output Content-Disposition: attachment.
 * Access: owner, super_admin, hr_admin, finance_admin, employee self.
 */
import { findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { handler, unauthorized, forbidden, notFound } from '@/lib/http';
import { formatIdr } from '@/lib/format';

export const GET = handler(async (req, { params }) => {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = params;
  const payroll = await findRow(TABS.payroll, 'payroll_id', id);
  if (!payroll) return notFound('Payroll not found');
  const row = payroll.row;

  // Role-based access: self can only view own
  const isSelf = session.role === 'employee' && session.userId === row.employee_id;
  const isPrivileged = ['owner', 'super_admin', 'hr_admin', 'finance_admin'].includes(session.role);
  if (!isSelf && !isPrivileged) return forbidden();

  const lines = [
    'SLIP GAJI YKP',
    '===============',
    '',
    `Periode : ${row.payroll_period}`,
    `Nama    : ${row.employee_name}`,
    `Outlet  : ${row.outlet_id}`,
    '',
    'PENDAPATAN',
    `  Gaji Pokok        : ${formatIdr(row.basic_salary)}`,
    `  Lembur            : ${formatIdr(row.overtime_pay)}`,
    `  Bonus             : ${formatIdr(row.bonus_total)}`,
    `  Tunjangan         : ${formatIdr(row.allowance_total)}`,
    '',
    'POTONGAN',
    `  Potongan Hadir    : ${formatIdr(row.attendance_deduction)}`,
    `  Penalty           : ${formatIdr(row.penalty_total)}`,
    `  Kasbon            : ${formatIdr(row.cash_advance_deduction)}`,
    `  Lainnya           : ${formatIdr(row.other_deduction)}`,
    '',
    `GROSS SALARY        : ${formatIdr(row.gross_salary)}`,
    `NET SALARY          : ${formatIdr(row.net_salary)}`,
    '',
    `Status Bayar        : ${row.payment_status || 'UNPAID'}`,
    '--- CONFIDENTIAL ---'
  ];
  const body = lines.join('\n');
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="slip-${id}.txt"`
    }
  });
});
