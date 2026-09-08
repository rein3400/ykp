# HR Payroll Controls

## ADDED Requirements

### Requirement: Separation of duties on HR approvals

The system SHALL reject an approval decision when the deciding user is the
requester (`created_by` of the target row equals the session user).

- Applies to: leave approval, adjustment approval, lateness approval, payroll approval.
- Rejection MUST return 403 with an explicit self-approval message.
- REJECT decisions on own requests MAY be allowed (rejecting oneself harms no one); APPROVE and NEEDS_REVISION on own requests MUST be rejected.
- Audit log MUST record rejected self-approval attempts (actor, entity, entity id).

#### Scenario: supervisor approves own overtime

- **WHEN** user U with an approver role submits an APPROVE decision on an adjustment whose `created_by` is U
- **THEN** the system returns 403 with a self-approval message and records the attempt in the audit log.

#### Scenario: supervisor rejects own leave request

- **WHEN** user U submits a REJECT decision on their own PENDING leave request
- **THEN** the request transitions to REJECTED normally.

### Requirement: Regenerate audit trail

When payroll generation overwrites an existing PENDING/REJECTED/NEEDS_REVISION
row, the system SHALL write a per-row before/after record to the audit log
(old net/gross vs new net/gross, actor, timestamp) so approvers can see figure
history. Bulk generate MUST NOT silently replace figures.

#### Scenario: regenerate changes a pending figure

- **WHEN** payroll generation recomputes a PENDING row whose net differs from the stored net
- **THEN** the audit log contains one entry with the old and new net/gross, actor, and timestamp.

### Requirement: Scope-honesty labeling

The payroll approve UI and the payslip (text and email) SHALL display a notice
that figures exclude BPJS and tax while the V1 engine hardcodes both to zero.
The notice MUST disappear (or invert) once real BPJS/tax computation lands.

#### Scenario: approver sees scope notice

- **WHEN** an approver opens a PENDING payroll row for review
- **THEN** the UI shows that the figures exclude BPJS and tax.

### Requirement: Transfer reconciliation

The finance transfer notification endpoint SHALL accept an optional transfer
amount per payroll row. When provided, the system SHALL compare it against the
approved net salary and flag mismatches (amount + direction) visible to HR and
finance. Notification without amounts remains allowed (stamp-only, explicitly
marked unverified).

#### Scenario: transfer amount mismatches approved net

- **WHEN** finance notifies a transfer of Rp4.000.000 against an approved net of Rp4.200.000
- **THEN** the row is flagged with the mismatch amount and direction, visible to HR and finance.

### Requirement: Bulk-notify confirmation data

Before stamping a whole period/brand, the endpoint SHALL return the row count
and summed approved net total so the caller can confirm. The stamp is applied
only after explicit confirmation with those totals.

#### Scenario: bulk stamp shows totals first

- **WHEN** finance requests a bulk stamp for period 2026-08 brand BR-001 covering 10 rows totaling Rp42.000.000
- **THEN** the system returns the count and total for confirmation before applying any stamp.

### Requirement: Payslip email retry

When payslip email delivery fails (`email_sent_status` FAILED), the system
SHALL expose a resend action. Approval MUST remain successful even when email
fails (never block money on notifications).

#### Scenario: resend after failed delivery

- **WHEN** a payroll row has `email_sent_status` FAILED and an authorized user triggers resend
- **THEN** the system attempts delivery again, updates the status, and records an audit entry; the approval state is unchanged.
