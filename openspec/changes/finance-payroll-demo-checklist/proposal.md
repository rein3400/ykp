# Proposal: Finance Payroll Demo Checklist

## Why

Second wave of client demo feedback (2026-10) targeted the Finance payroll queue. Code audit found 3 gaps: the Finance "Minta Revisi" button sets state but renders NO popup and `submitRevision` is dead code (items 4–5 FAIL: no mandatory-reason form, clicking does nothing); HR's "Validasi Pembayaran"/"Tandai Dibayar" buttons only render while rows are UNLOCKED, but auto-approved rows are LOCKED (item 8 FAIL in UI); payslip emails contain inline HTML only with no formal file attachment (items 9–10 missing "lampiran file").

## What Changes

- `ykp-finance-v1` payroll-client: render a revision modal (employee name + mandatory textarea ≥5 chars + validation + submit/cancel) wired to the existing `submitRevision` — popup enforced on "Minta Revisi".
- `ykp-hr-v1` payroll-table: show "Validasi Pembayaran" + "Tandai Dibayar" for `isApproved && isUnpaid` **regardless of lock** (server routes already accept locked rows: PAID stamp adds evidence, never figure edits).
- `ykp-hr-v1` payslip email now attaches a formal PDF (`Slip-Gaji-<periode>-<nama>.pdf`, generated via `pdfkit`, brand header + komponen + net) alongside the inline HTML.
- Verification-only items confirmed PASS without code change: read-only queue (Nama/No Rekening/Nominal, no number inputs), no upload-bukti form, NEEDS_REVISION rows locked-out of Finance queue + actions hidden, payroll auto-handoff to HR (shared tab), audit trail coverage (create/update before-after, generate, revision+reason, transfer, validation, email) + read-only audit menu.

## Capabilities

### New Capabilities
- `finance/payroll-revision-modal`: mandatory-reason revision popup on Finance payroll queue.
- `hr/payroll-payment-validation-ui`: payment validation actions available for locked (auto-approved) rows.
- `hr/payslip-pdf-attachment`: formal PDF file attached to the payslip email.

### Modified Capabilities
(none)

## Impact

- Files: `ykp-finance-v1/src/app/finance/payroll/payroll-client.tsx`; `ykp-hr-v1/src/features/hr/components/payroll-table.tsx`; `ykp-hr-v1/src/lib/payslip-email.ts` (+ new `src/lib/payslip-pdf.ts`); validate-payment route unchanged (already supports attachment plumbing via sendPayslipEmail).
- **New dependency**: `pdfkit` + `@types/pdfkit` (pure-JS PDF, no native deps) — required by explicit client expectation of a formal file attachment.
- Deploy: SMTP config still required in prod for real sends (already known P0).