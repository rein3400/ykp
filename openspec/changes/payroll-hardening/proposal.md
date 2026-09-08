## Why

HR payroll controls money leaving the company, but verification (2026-09-07) found the requester can approve their own request on all four HR approval routes, payroll regenerate overwrites pre-approval figures without a before/after trail, and the finance transfer notification carries no amount to reconcile against. Finance and warehouse already enforce separation of duties; HR does not. Fix before pilot, while data is still synthetic.

## What Changes

- **A. SoD guard on 4 HR approval routes** (`leaves/approve`, `adjustments/approve`, `lateness/approve`, `payroll/approve`): reject when `created_by === session.userId` (same 2-line pattern finance already uses).
- **B. Regenerate audit trail** (`payroll/generate`): log before/after per overwritten row (or period snapshot) so approvers see figure history.
- **C. Scope honesty label**: approve UI + payslip show "belum termasuk BPJS/pajak" (engine hardcodes both to 0 per V1 scope).
- **D. Transfer reconciliation** (`payroll/finance-notify`): accept optional transfer amount per row; flag mismatch vs approved net.
- **E. Bulk-notify confirmation**: show row count x total amount before stamping a whole period/brand.
- **F. Payslip email retry**: resend button when `email_sent_status` is FAILED.
- Order: A+B first (integrity), D+E (reconciliation), C+F (honesty/UX). No data pack needed.

## Capabilities

### New Capabilities

- `hr/payroll-controls`: separation-of-duties enforcement, regenerate audit trail, transfer reconciliation, and scope-honesty labeling for the payroll lifecycle (generate -> approve -> mark-paid -> notify).

### Modified Capabilities

- None (no existing specs under `openspec/specs/`; briefs live outside OpenSpec).

## Impact

- Touched: `ykp-hr-v1/src/app/api/hr/{leaves,adjustments,lateness,payroll/*}/**`, `payroll-table.tsx`, `hr_payroll` tab headers (item D adds optional columns), audit log volume (item B).
- No breaking API changes: new rejections return 403 with explicit message; new fields optional.
- No dependency changes. No cross-module changes (finance-notify stays one-way; full two-way reconciliation is out of scope).
