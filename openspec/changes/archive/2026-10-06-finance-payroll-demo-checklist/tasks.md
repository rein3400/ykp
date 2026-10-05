# Tasks — Finance Payroll Demo Checklist

## 1. Finance revision popup (items 4–5, 7)

- [x] 1.1 `payroll-client.tsx`: render revision modal when `revisionFor` is set — employee name, mandatory reason textarea (≥5 chars, inline error), submit wired to `submitRevision`, cancel resets state
- [x] 1.2 Verify NEEDS_REVISION row shows "MENUNGGU REVISI HR" + locked notice + excluded from HARUS DIBAYAR (existing behaviour)

## 2. HR payment actions on locked rows (items 8, 9)

- [x] 2.1 `payroll-table.tsx`: drop `!isLocked` from "Validasi Pembayaran" + "Tandai Dibayar" render conditions (routes already lock-stamp PAID)

## 3. Payslip PDF attachment (items 9–10)

- [x] 3.1 New `ykp-hr-v1/src/lib/payslip-pdf.ts`: `buildPayslipPdfAttachment()` → `{ filename, content: Buffer }` formal slip (brand header, periode, pegawai, komponen, gross/net, payment reference)
- [x] 3.2 `payslip-email.ts`: optional `attachment` param → nodemailer `attachments`; `validate-payment/route.ts` builds + passes the PDF
- [x] 3.3 Test: pdf build returns Buffer + filename; email mock path unchanged without SMTP

## 4. Verification

- [x] 4.1 hr-v1 + finance-v1: `tsc --noEmit`, `lint`, `npm test` green
- [x] 4.2 E2E dev cross-app: generate (auto-lock) → Finance popup revisi → HR regenerate → Finance tandai transfer validasi → HR validasi pembayaran → PAID (email mocked) → audit entries complete
- [x] 4.3 Read-only confirmation documented: queue numbers not editable, no upload-bukti form, audit menu no edit/delete buttons