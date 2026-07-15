/**
 * Generate an HTML payslip with print-friendly CSS.
 * Browser Print -> Save as PDF for production V1 (no puppeteer/pdfkit dep).
 * Access: owner, super_admin, hr_admin, finance_admin, employee self.
 */
import { findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { handler, unauthorized, forbidden, notFound } from '@/lib/http';
import { formatIdr } from '@/lib/format';
import { NextResponse } from 'next/server';

function html(s: TemplateStringsArray, ...vals: unknown[]): string {
  return String.raw({ raw: s }, ...vals.map((v) => String(v ?? '')));
}

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

  const paymentDate = row.payment_date
    ? new Date(row.payment_date).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'long', day: 'numeric' })
    : '-';

  const body = html`
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slip Gaji - ${row.employee_name} - ${row.payroll_period}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a2e;
    background: #f4f6f9;
    line-height: 1.5;
  }
  .container {
    max-width: 800px;
    margin: 24px auto;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 1px 6px rgba(0,0,0,0.08);
    overflow: hidden;
  }
  .header {
    background: #1a1a2e;
    color: #fff;
    padding: 28px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-brand { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
  .header-label {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    opacity: 0.75;
  }
  .meta {
    padding: 24px 32px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 32px;
    border-bottom: 1px solid #e8ecf1;
  }
  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-label { font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
  .meta-value { font-size: 15px; font-weight: 500; }
  .section { padding: 20px 32px; }
  .section-title {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #374151;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid #e8ecf1;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 0; text-align: left; font-size: 14px; }
  th { font-weight: 500; color: #6b7280; }
  td { font-weight: 500; }
  td.amount { text-align: right; font-variant-numeric: tabular-nums; }
  tr.total td { font-weight: 700; border-top: 1px solid #d1d5db; padding-top: 10px; }
  .net-salary {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 6px;
    padding: 16px 20px;
    margin: 0 32px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .net-label { font-size: 14px; font-weight: 600; color: #166534; }
  .net-value { font-size: 22px; font-weight: 800; color: #15803d; }
  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 32px;
    border-top: 1px solid #e8ecf1;
    font-size: 14px;
  }
  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .status-paid { background: #d1fae5; color: #065f46; }
  .status-unpaid { background: #fee2e2; color: #991b1b; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .footer {
    padding: 16px 32px;
    text-align: center;
    font-size: 11px;
    color: #9ca3af;
    border-top: 1px solid #e8ecf1;
  }
  .toolbar {
    max-width: 800px;
    margin: 0 auto 16px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid #d1d5db;
    background: #fff;
    color: #374151;
    text-decoration: none;
    transition: background 0.15s;
  }
  .btn:hover { background: #f3f4f6; }
  .btn-primary { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
  .btn-primary:hover { background: #2d2d4a; }

  @media print {
    body { background: #fff; }
    .container { box-shadow: none; border-radius: 0; margin: 0; max-width: 100%; }
    .toolbar { display: none; }
    .header { background: #1a1a2e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .net-salary { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { margin: 12mm; size: A4; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <button class="btn" onclick="window.print()">Cetak / Save PDF</button>
  <a class="btn btn-primary" download="slip-${id}.html" href="data:text/html;charset=utf-8,${encodeURIComponent('')}">Download HTML</a>
</div>
<div class="container">
  <div class="header">
    <div>
      <div class="header-brand">YKP</div>
      <div style="font-size:13px;opacity:0.7;margin-top:2px;">Yayasan Karya Padjadjaran</div>
    </div>
    <div class="header-label">Slip Gaji</div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <span class="meta-label">Nama</span>
      <span class="meta-value">${row.employee_name}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Periode</span>
      <span class="meta-value">${row.payroll_period}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Outlet</span>
      <span class="meta-value">${row.outlet_id}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">ID Karyawan</span>
      <span class="meta-value">${row.employee_id}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Pendapatan</div>
    <table>
      <tr><th>Gaji Pokok</th><td class="amount">${formatIdr(row.basic_salary)}</td></tr>
      <tr><th>Lembur</th><td class="amount">${formatIdr(row.overtime_pay)}</td></tr>
      <tr><th>Bonus</th><td class="amount">${formatIdr(row.bonus_total)}</td></tr>
      <tr><th>Tunjangan</th><td class="amount">${formatIdr(row.allowance_total)}</td></tr>
      <tr class="total"><th>Gross Salary</th><td class="amount">${formatIdr(row.gross_salary)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Potongan</div>
    <table>
      <tr><th>Potongan Hadir</th><td class="amount">${formatIdr(row.attendance_deduction)}</td></tr>
      <tr><th>Penalty</th><td class="amount">${formatIdr(row.penalty_total)}</td></tr>
      <tr><th>Kasbon</th><td class="amount">${formatIdr(row.cash_advance_deduction)}</td></tr>
      <tr><th>BPJS</th><td class="amount">${formatIdr(row.bpjs_deduction)}</td></tr>
      <tr><th>Pajak</th><td class="amount">${formatIdr(row.tax_deduction)}</td></tr>
      <tr><th>Lainnya</th><td class="amount">${formatIdr(row.other_deduction)}</td></tr>
    </table>
  </div>

  <div class="net-salary">
    <span class="net-label">Gaji Bersih (Net Salary)</span>
    <span class="net-value">${formatIdr(row.net_salary)}</span>
  </div>

  <div class="status-row">
    <div>
      <span style="color:#6b7280;">Status Pembayaran:</span>
      <span class="status-badge ${row.payment_status === 'PAID' ? 'status-paid' : row.payment_status === 'PENDING' ? 'status-pending' : 'status-unpaid'}">${row.payment_status || 'UNPAID'}</span>
    </div>
    <div>
      <span style="color:#6b7280;">Tanggal Bayar:</span>
      <span style="font-weight:500;">${paymentDate}</span>
    </div>
  </div>

  <div class="footer">
    Dokumen ini dibuat secara elektronik oleh sistem YKP HR &mdash; CONFIDENTIAL
  </div>
</div>
<script>
  // Populate download link with actual HTML content on load
  (function() {
    var a = document.querySelector('a[download]');
    if (a) a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(document.documentElement.outerHTML);
  })();
</script>
</body>
</html>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
});
