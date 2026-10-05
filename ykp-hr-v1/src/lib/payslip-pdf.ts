/**
 * Formal payslip PDF attachment for the payslip email (finance-payroll-demo-checklist).
 * Client requirement: "lampiran file formal slip gaji diterima rapi" — the email
 * carries a neat PDF built server-side from the same computed payroll row.
 * Kept intentionally tabular; the browser HTML slip remains the rich preview.
 */
import PDFDocument from 'pdfkit';

export interface PayslipPdfInput {
  payrollRow: Record<string, string | number>;
  employeeName: string;
  brandName: string;
  brandId: string;
  payrollPeriod: string;
}

function rp(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

/** Build the payslip PDF; resolves a Buffer (nodemailer attachment content). */
export function buildPayslipPdf(input: PayslipPdfInput): Promise<Buffer> {
  const r = input.payrollRow;
  const num = (v: string | number | undefined) => Number(v ?? 0);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Slip Gaji ${input.payrollPeriod}` } });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => reject(new Error('PDF generation timeout')), 10_000);
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
    doc.on('error', (e: Error) => { clearTimeout(timer); reject(e); });

    doc.fontSize(14).font('Helvetica-Bold')
      .fillColor('#111827')
      .text(`Slip Gaji — ${input.brandName}`, { paragraphGap: 2 });
    doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
      .text(`Brand: ${input.brandId}  •  Periode: ${input.payrollPeriod}`)
      .text(`Nama: ${input.employeeName} (${r.employee_id})`)
      .moveDown(0.5)
      .moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#9ca3af').stroke()
      .moveDown(0.8);

    doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold')
      .text('Komponen Gaji', { paragraphGap: 4 });
    const rows: Array<[string, string, boolean]> = [
      ['Gaji Pokok', rp(num(r.basic_salary)), false],
      ['Hari Hadir (presensi)', String(r.attendance_days ?? ''), false],
      ['Hari Absen', String(r.absent_days ?? ''), false],
      ['Potongan Absen', rp(num(r.attendance_deduction)), true],
      ['Lembur (jam)', String(r.overtime_hours ?? ''), false],
      ['Upah Lembur', rp(num(r.overtime_pay)), false],
      ['Bonus', rp(num(r.bonus_total)), false],
      ['Insentif', rp(num(r.incentive_total)), false],
      ['Penalti', rp(num(r.penalty_total)), true],
      ['Tunjangan', rp(num(r.allowance_total)), false],
      ['Kasbon', rp(num(r.cash_advance_deduction)), true],
      ['BPJS', rp(num(r.bpjs_deduction)), true],
      ['Pajak', rp(num(r.tax_deduction)), true],
      ['Potongan Lain', rp(num(r.other_deduction)), true]
    ];
    for (const [label, value, deduct] of rows) {
      const y = doc.y;
      doc.fontSize(10).font(deduct ? 'Helvetica-Oblique' : 'Helvetica')
        .fillColor(deduct ? '#b91c1c' : '#111827').text(label, 48, y);
      doc.text(value, { align: 'right' });
    }

    doc.moveDown(0.6).moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#9ca3af').stroke().moveDown(0.6);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827')
      .text('Gross', 48, doc.y);
    doc.text(rp(num(r.gross_salary)), { align: 'right' });
    doc.text('NET DITERIMA', 48, doc.y + 4);
    doc.text(rp(num(r.net_salary)), { align: 'right' });

    const ref = String(r.payment_reference ?? '').trim();
    if (ref) {
      doc.moveDown(0.8).font('Helvetica').fontSize(9).fillColor('#6b7280')
        .text(`Status: PAID • Tanggal Bayar: ${r.payment_date ?? ''} • Referensi: ${ref}`);
    }
    doc.moveDown(0.6).fontSize(8).fillColor('#9ca3af')
      .text('Dokumen ini dihasilkan otomatis oleh YKP HR dan bersifat resmi sebagai catatan slip gaji periodik.');

    doc.end();
  });
}

/** Nodemailer-ready attachment descriptor. */
export async function buildPayslipPdfAttachment(input: PayslipPdfInput): Promise<{
  filename: string; content: Buffer;
}> {
  const content = await buildPayslipPdf(input);
  const safeName = input.employeeName.replace(/[^\w\s-]/g, ' ').trim().replace(/\s+/g, '-');
  return { filename: `Slip-Gaji-${input.payrollPeriod}-${safeName}.pdf`, content };
}