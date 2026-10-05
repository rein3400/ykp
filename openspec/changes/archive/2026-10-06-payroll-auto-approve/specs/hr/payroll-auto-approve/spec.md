# Payroll Auto-Approve — Delta Spec

## Purpose

Lets HR create payroll in one click: generating a payroll period immediately locks the rows and exposes them to Finance as payable, with owner unlock as the only escalation hatch and a working revision path for locked rows.

## ADDED Requirements

### Requirement: Generate produces payment-ready locked rows

`POST /api/hr/payroll/generate` SHALL finish every generated/updated payroll row in the payment-ready state in the same request: `calculation_status=DRAFT`, `approval_status=APPROVED`, `payment_status=READY_TO_PAY`, `locked_status=LOCKED` (with `locked_at`/`locked_by` stamped). The generating session user SHALL be recorded as both generator and approver (`approved_by` = generating user; approval timestamp = `updated_at` — the tab intentionally has no `approved_at` column) with a single audit entry acknowledging the combined action.

#### Scenario: HR admin generates a payroll period

- **WHEN** a user with `generate` permission on payroll (e.g. `hr_admin`) submits a valid period to the generate endpoint
- **THEN** all resulting employee rows are stored `APPROVED + READY_TO_PAY + LOCKED` with `approved_by` equal to that user, and the endpoint returns the upserted rows
- **AND** no separate approve call is required for Finance to treat the rows as payable

#### Scenario: Existing locked rows are not touched

- **WHEN** generate runs on a period some of whose rows are already `LOCKED` (previously approved or PAID)
- **THEN** generate returns `409` for the period without modifying any locked row (unchanged behaviour)

### Requirement: Finance visibility of auto-approved rows

The Finance payable predicate (`approval_status` ∈ {APPROVED, READY_TO_PAY} and `payment_status` ≠ PAID) SHALL treat freshly generated rows as payable immediately after generation. Legacy `PENDING` rows in the shared `hr_payroll` tab SHALL remain excluded from the payable queue.

#### Scenario: Finance sees generated payroll right away

- **WHEN** HR generates a period and Finance reloads the payroll overview (shared-tab read)
- **THEN** those rows appear under "HARUS DIBAYAR" with status indicating approved/auto-locked, without any HR-side action between generate and Finance view

### Requirement: Legacy approve endpoint remains compatible

The per-row approve endpoint SHALL remain available and idempotent: approving a row already `APPROVED` SHALL succeed without state changes; approving an unlocked non-approved row SHALL behave as before (lock + `READY_TO_PAY`). The dashboard UI SHALL NOT render the per-row "Setujui" button anymore.

#### Scenario: Double-approve is a no-op

- **WHEN** an approver-role user POSTs approve for a row that is already `APPROVED` and unlocked
- **THEN** the response is `200` and the row's statuses are unchanged

#### Scenario: Approve button no longer renders

- **WHEN** any role views the payroll table for rows that are `APPROVED + LOCKED`
- **THEN** no per-row approve button is rendered

### Requirement: Revision path works for locked unpaid rows

`POST /api/hr/payroll/needs-revision` SHALL accept `LOCKED` rows whose `payment_status` is not `PAID`: the transition sets `approval_status=NEEDS_REVISION`, unlocks the row (`locked_status=UNLOCKED`), and records the revision reason. PAID rows SHALL still be rejected.

#### Scenario: Finance requests revision on an auto-approved row

- **WHEN** Finance requests a revision with a reason for a `LOCKED + APPROVED + UNPAID` row
- **THEN** the row becomes `NEEDS_REVISION + UNLOCKED`, HR can regenerate/update it, and the reason is stored

#### Scenario: Revision still rejected after payment

- **WHEN** Finance requests a revision for a `PAID` row
- **THEN** the endpoint returns `409` without state change

### Requirement: Owner unlock remains the escalation hatch

Only `owner`/`super_admin` SHALL be able to unlock a locked payroll row, with a mandatory reason (unchanged behaviour). After unlock, generate/re-generate of the affected period becomes possible again.

#### Scenario: Owner unlocks a generated row

- **WHEN** the owner unlocks a `LOCKED` row with a reason
- **THEN** the row is `UNLOCKED` and a period re-generate no longer fails with `409` for that period state

### Requirement: SoD exclusion for payroll auto-approve

The separation-of-duties self-approval guard (from the `hr/payroll-controls` capability) SHALL NOT apply to the payroll generate action or the payroll approve action: generating and approving payroll by the same session user is accepted by design, and the audit entry records both roles in one action.

#### Scenario: Self-generated auto-approved payroll is accepted

- **WHEN** the same `hr_admin` user generates and thus auto-approves a payroll period
- **THEN** no self-approval error is raised and the audit log records the single combined action