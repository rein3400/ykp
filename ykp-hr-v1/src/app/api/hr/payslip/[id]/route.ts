/**
 * Generate an HTML payslip with print-friendly CSS.
 * Browser Print -> Save as PDF for production V1 (no puppeteer/pdfkit dep).
 * Access: owner, super_admin, hr_admin, finance_admin, employee self.
 */
import { findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { handler, unauthorized, forbidden, notFound } from '@/lib/http';
import { buildPayslipHtml } from '@/lib/payslip-html';
import { NextResponse } from 'next/server';

export const GET = handler(async (req, { params }) => {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = params;
  const payroll = await findRow(TABS.payroll, 'payroll_id', id);
  if (!payroll) return notFound('Payroll not found');
  const row = payroll.row;

  // Role-based access: self can only view own. session.employeeId is the
  // linked EMP- id (set at login from users.employee_id); session.userId is
  // USR- and never equals row.employee_id (EMP-), so the old check always 403'd.
  const isSelf = session.role === 'employee' && session.employeeId === row.employee_id;
  const isPrivileged = ['owner', 'super_admin', 'hr_admin', 'finance_admin'].includes(session.role);
  if (!isSelf && !isPrivileged) return forbidden();

  const body = buildPayslipHtml(id, row);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
});
