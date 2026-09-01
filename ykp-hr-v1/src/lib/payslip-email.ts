import { findRow, TABS } from '@/db/sheets';
import { formatIdr } from '@/lib/format';
import { getSmtpConfig } from '@/lib/app-settings';

export interface BrandEmailConfig {
  email: string;
  brandName: string;
}

const BRAND_STYLES: Record<string, { primary: string; accent: string; logoText: string }> = {
  'BR-001': { primary: '#1a1a2e', accent: '#e94560', logoText: 'FUNKYDAK' },
  'BR-002': { primary: '#c41e3a', accent: '#ff6b35', logoText: 'SEKARPIZZA' },
  'BR-003': { primary: '#2d5016', accent: '#8fbc8f', logoText: 'SUBURBUNS' },
  'BR-004': { primary: '#5c4033', accent: '#d4a574', logoText: 'LAJU KOPI' },
  'BR-005': { primary: '#8b4513', accent: '#daa520', logoText: 'UNCLE MASALA' }
};

export function getBrandStyle(brandId: string) {
  return BRAND_STYLES[brandId] ?? BRAND_STYLES['BR-001'];
}

export async function getBrandEmail(brandId: string): Promise<BrandEmailConfig | null> {
  const found = await findRow(TABS.brands, 'brand_id', brandId);
  if (!found) return null;
  const email = (found.row.email as string ?? '').trim();
  const brandName = (found.row.brand_name as string ?? brandId).trim();
  if (!email) return null;
  return { email, brandName };
}

export function buildPayslipEmailHtml(opts: {
  employeeName: string;
  payrollPeriod: string;
  brandName: string;
  brandId: string;
  payroll: Record<string, string>;
}): { subject: string; html: string; text: string } {
  const style = getBrandStyle(opts.brandId);
  const p = opts.payroll;
  const subject = `Slip Gaji ${opts.payrollPeriod} - ${opts.brandName} - ${opts.employeeName}`;
  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a2e;background:#f4f6f9;line-height:1.5}
.container{max-width:640px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.08)}
.header{background:${style.primary};color:#fff;padding:24px 28px;display:flex;justify-content:space-between;align-items:center}
.header-brand{font-size:18px;font-weight:700;letter-spacing:.5px}
.header-label{font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8}
.meta{padding:20px 28px;display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;border-bottom:1px solid #e8ecf1;font-size:13px}
.meta-label{color:#6b7280;font-weight:500}
.meta-value{font-weight:600}
.section{padding:16px 28px}
.section-title{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7280;margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{font-weight:500;color:#6b7280;text-align:left;padding:6px 0}
td{font-weight:500;padding:6px 0}
td.amount{text-align:right;font-variant-numeric:tabular-nums}
tr.total td{font-weight:700;border-top:1px solid #d1d5db;padding-top:8px}
.net-salary{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:14px 20px;margin:0 28px 16px;display:flex;justify-content:space-between;align-items:center}
.net-label{font-size:13px;font-weight:600;color:#166534}
.net-value{font-size:18px;font-weight:800;color:#15803d}
.footer{padding:14px 28px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e8ecf1}
</style></head><body>
<div class="container">
<div class="header"><div class="header-brand">${style.logoText}</div><div class="header-label">Slip Gaji</div></div>
<div class="meta">
<div><span class="meta-label">Nama</span><br><span class="meta-value">${escapeHtml(p.employee_name)}</span></div>
<div><span class="meta-label">Periode</span><br><span class="meta-value">${escapeHtml(p.payroll_period)}</span></div>
<div><span class="meta-label">ID Karyawan</span><br><span class="meta-value">${escapeHtml(p.employee_id)}</span></div>
<div><span class="meta-label">Tanggal Bayar</span><br><span class="meta-value">${escapeHtml(p.payment_date || '-')}</span></div>
</div>
<div class="section"><div class="section-title">Pendapatan</div>
<table>
<tr><th>Gaji Pokok</th><td class="amount">${formatIdr(p.basic_salary)}</td></tr>
<tr><th>Lembur</th><td class="amount">${formatIdr(p.overtime_pay)}</td></tr>
<tr><th>Bonus</th><td class="amount">${formatIdr(p.bonus_total)}</td></tr>
<tr><th>Tunjangan</th><td class="amount">${formatIdr(p.allowance_total)}</td></tr>
<tr class="total"><th>Gross</th><td class="amount">${formatIdr(p.gross_salary)}</td></tr>
</table></div>
<div class="section"><div class="section-title">Potongan</div>
<table>
<tr><th>Pot. Kehadiran</th><td class="amount">${formatIdr(p.attendance_deduction)}</td></tr>
<tr><th>Penalty</th><td class="amount">${formatIdr(p.penalty_total)}</td></tr>
<tr><th>Kasbon</th><td class="amount">${formatIdr(p.cash_advance_deduction)}</td></tr>
<tr><th>BPJS</th><td class="amount">${formatIdr(p.bpjs_deduction)}</td></tr>
<tr><th>Pajak</th><td class="amount">${formatIdr(p.tax_deduction)}</td></tr>
<tr><th>Lainnya</th><td class="amount">${formatIdr(p.other_deduction)}</td></tr>
</table></div>
<div class="net-salary"><span class="net-label">Gaji Bersih</span><span class="net-value">${formatIdr(p.net_salary)}</span></div>
<div class="footer">Dokumen ini dikirim otomatis dari ${escapeHtml(opts.brandName)} &middot; ${escapeHtml(style.logoText)} &middot; Harap simpan slip ini dengan baik.</div>
</div></body></html>`;
  const text = `Slip Gaji ${opts.payrollPeriod} - ${opts.employeeName}\nBrand: ${opts.brandName}\nGross: ${formatIdr(p.gross_salary)}\nNet: ${formatIdr(p.net_salary)}\nPeriode: ${p.payroll_period}`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export interface SendResult {
  sent: boolean;
  mocked: boolean;
  messageId?: string;
  error?: string;
}

export async function sendPayslipEmail(opts: {
  to: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const cfg = await getSmtpConfig();
  const smtpHost = cfg.host;
  const smtpUser = cfg.user;
  const smtpPass = cfg.pass;
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log(`[payslip-email MOCK] From: ${opts.fromName} <${opts.fromEmail}> To: ${opts.to} Subject: ${opts.subject}`);
    return { sent: true, mocked: true, messageId: `mock-${Date.now()}` };
  }
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(cfg.port || 587),
      secure: cfg.secure === 'true',
      auth: { user: smtpUser, pass: smtpPass }
    });
    const info = await transporter.sendMail({
      from: `${opts.fromName} <${opts.fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text
    });
    return { sent: true, mocked: false, messageId: info.messageId };
  } catch (e) {
    return { sent: false, mocked: false, error: e instanceof Error ? e.message : String(e) };
  }
}