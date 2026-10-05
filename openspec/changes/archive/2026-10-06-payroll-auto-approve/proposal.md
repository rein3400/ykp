# Proposal: Payroll Auto-Approve (Generate → Locked → Finance)

## Why

Client demo feedback (2026-10, outlets Sekar Pizza Colombo/Tirtodipuran, Funkydak Demangan, Suburbun Demangan) explicitly rejects the extra HR approve step: *"klik tombol Generate Payroll oleh HR (pastikan langsung mengunci data dan terkirim ke Finance tanpa tombol approve tambahan)"*. Today `POST /api/hr/payroll/generate` only produces `DRAFT + PENDING` rows; locking + `READY_TO_PAY` happens only after a separate per-row **"Setujui"** click (`/api/hr/payroll/approve`), which requires `owner`/`super_admin` RBAC — so `hr_admin` sees a button that 403s. The owner decided (2026-10-05) to adopt **auto-approve**: Generate locks immediately, owner unlock remains the safety hatch.

## What Changes

- `POST /api/hr/payroll/generate` now finishes each generated row in the terminal pre-payment state: `calculation_status=DRAFT`, `approval_status=APPROVED` (honest label of the same user acting as generator+approver), `payment_status=READY_TO_PAY`, `locked_status=LOCKED`, `approved_by=generated_by`, `approved_at` set. Audit records the single `generate` action as both.
- Per-row **"Setujui"** button is removed from `/hr/payroll` table; `/api/hr/payroll/approve` route is kept (backwards-compatible, idempotent for `APPROVED` rows) but no longer part of the happy path.
- `needs-revision` accepts LOCKED-but-unpaid rows (revision was previously a dead end for locked rows; with auto-approve every generated row starts locked) and unlocks the row when transitioning to `NEEDS_REVISION`.
- Finance side (`ykp-finance-v1`) needs no change — `payableOf()` already accepts `APPROVED`; PENDING rows (legacy data) remain excluded. Status chip copy updated to reflect auto-approve.
- UI copy fixes: `/hr/payroll/generate` period page ("Re-generate aman…" vs the 409-on-any-LOCKED behaviour) and payroll-table hints updated to describe the new one-click flow.
- Reconciliation of the sibling change `openspec/changes/payroll-hardening/`: its SoD requirement deliberately excludes the payroll approve/generate action (self-approval is the accepted design here); other payroll-hardening items (regenerate audit trail, transfer reconciliation, etc.) are unaffected.
- **BREAKING** for anyone relying on "Generate leaves rows PENDING": external consumers reading `approval_status` must treat freshly generated rows as `APPROVED`. No column schema changes (no new Sheets headers).

## Capabilities

### New Capabilities
- `hr/payroll-auto-approve`: One-click HR payroll generate that locks and exposes rows to Finance immediately, with owner unlock and revision paths preserved.

### Modified Capabilities
<!-- none — no main specs exist yet (openspec/specs/ is empty); conflict with the
     pending payroll-hardening delta is resolved inside this change + an artifact
     edit task on that change. -->

(none)

## Impact

- Code: `ykp-hr-v1/src/app/api/hr/payroll/generate/route.ts`, `approve/route.ts` (kept, minor), `needs-revision/route.ts` (unlock-on-revision), `src/features/hr/components/payroll-table.tsx` (remove Setujui, update hints), `src/app/hr/payroll/generate/page.tsx` (copy), `src/lib/rbac.ts` (no change needed — generate permission already covers the actor).
- Downstream: `ykp-finance-v1` `src/lib/hr-payroll-bridge.ts` (no change), `payroll-client.tsx` copy only; shared `hr_payroll` tab carries same headers.
- Governance: `payroll-hardening` SoD delta (specs/hr/payroll-controls) must be narrowed to exclude payroll.
- Tests: `ykp-hr-v1` payroll route tests + `ykp-finance-v1/tests/payroll-overview.test.ts` (PENDING-exclusion case remains valid for legacy rows only).