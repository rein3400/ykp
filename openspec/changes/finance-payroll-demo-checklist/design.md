# Design — Finance Payroll Demo Checklist

## Context

`submitRevision` + `revisionFor/revisionReason/revisionError` state exist in `payroll-client.tsx` but no modal JSX references them (dead state); clicking only sets state → nothing visible. HR `validate-payment`/`mark-paid` routes ignore `locked_status` and stamp PAID+LOCKED — only the HR table's render condition `isApproved && isUnpaid && !isLocked` blocks them. `sendPayslipEmail` (nodemailer) has no `attachments` support today.

## Goals / Non-Goals

**Goals:** popup with mandatory reason; payment buttons on locked unpaid approved rows; PDF attachment via `pdfkit` reusing the computed row + brand config passed by the route.
**Non-Goals:** no finance-side upload/bukti forms (explicitly banned by client), no changes to endpoints/Sheets headers, no payslip layout redesign in the browser view.

## Decisions

1. **Modal JSX in finance client** — conditional render on `revisionFor` over a minimal absolute overlay; submit guards reason ≥5 chars; onCancel resets all three states. Reuses `submitRevision` unchanged.
2. **Remove `!isLocked` only from payment actions** (not from Setujui/legacy logic, not from Unlock): lock semantics = figure immutability; PAID stamp is lifecycle evidence. Server routes need no change (verified).
3. **PDF via `pdfkit`** (chosen over puppeteer/html-to-pdf: no native deps, small, offline) in a new `src/lib/payslip-pdf.ts` — `buildPayslipPdfAttachment(payroll row, employeeName, brandName)` → `{ filename, content: Buffer }`; wired as a second optional param of `sendPayslipEmail({..., attachment?})` → nodemailer `attachments: [{ filename, content }]`. validate-payment route builds+passes it. Mock path unaffected.
4. Audit already covers the demanded lifecycle (before/after update, generate, request_revision+reason, finance_notify_transfer, validate_payment, payslip_email) — no new code.

## Risks / Trade-offs

- [pdfkit layout drift vs HTML slip] → PDF kept intentionally simple/tabular; HTML remains the rich preview.
- [Modal z-index/scroll on small screens] → overlay + centered card, standard pattern already used in repo settings/smtp-client.

## Migration Plan

1. Deploy hr-v1 + finance-v1; run hr `npm test`. SMTP config stays the owner step for real attachments.
2. Rollback: previous image; PDF absence harmless.

## Open Questions

(none — client wording explicit; upload-bukti explicitly banned.)