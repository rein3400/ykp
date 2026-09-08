## Context

HR approval routes (`ykp-hr-v1/src/app/api/hr/*/approve`) follow one pattern:
session check -> `can(role,'approve',resource)` -> PENDING check -> write
`approved_by` + audit. Finance approval routes add one more check the HR ones
lack: creator cannot approve their own request. Payroll generate overwrites
unlocked rows in place with only a row-count audit entry. Finance-notify stamps
timestamps with no amounts. All changes are additive guards and optional
fields; no existing happy path changes shape.

## Goals / Non-Goals

**Goals:**

- Port the proven finance SoD pattern to HR with zero new abstractions.
- Make pre-approval figure changes visible to approvers.
- Make transfer notification reconcilable without forcing two-way sync.

**Non-Goals:**

- No shared approval library across modules (wanted long-term, but expands blast radius; revisit after pilot).
- No real BPJS/tax computation (out of scope V1 per brief §17).
- No two-way finance↔HR reconciliation ledger (stamp + mismatch flag only).
- No RBAC matrix changes (roles keep current permissions).

## Decisions

- **SoD as inline guard, not middleware.** Each of the 4 routes gets
  `if (found.row.created_by === session.userId) return forbidden(...)`
  mirroring finance. Alternative (central `assertNotSelf` lib) considered but
  deferred: 4 call sites don't justify a new abstraction yet, and inline keeps
  the diff reviewable per route. Prerequisite: verify `created_by` is populated
  and trustworthy on all 4 tabs before enforcing; routes missing it fail closed
  (reject) rather than open.
- **REJECT allowed on self, APPROVE/NEEDS_REVISION denied.** Rejecting your own
  request is harmless and unblocks queues; approving or bouncing it back to
  yourself is the integrity hole.
- **Regenerate trail via audit log, not snapshots table.** Per-row
  before/after JSON in `audit_log` reuses existing infra and matches the
  approve route's own `beforeValue`/`afterValue` convention. No schema change
  to `hr_payroll`. Trade-off: audit log grows; acceptable at pilot scale
  (Sheets quota, tens of rows per period).
- **Transfer amounts optional, never required.** Stamp-only notify keeps
  working (marked unverified in UI). Mismatch flag is a computed display
  (`transferred_amount` vs `net_salary`), not a blocking state — finance owns
  the correction workflow outside this change.
- **Email retry as explicit resend endpoint**, not auto-retry queue. Pilot
  scale makes a queue overkill; a button plus audit entry closes the loop.

## Risks / Trade-offs

- [Risk] `created_by` missing/unreliable on older rows -> guard misfires →
  Mitigation: backfill check first; fail closed with clear message pointing to
  data fix, not silent pass.
- [Risk] Small outlets where supervisor is the only approver -> SoD blocks
  legitimate flow → Mitigation: escalate to outlet_manager/brand_manager is
  the intended path; document it in the rejection message.
- [Risk] Audit log growth from per-row regenerate entries → Mitigation:
  entries are small JSON; revisit if a period exceeds ~200 rows.
- [Risk] Transfer amount columns on `hr_payroll` widen an already wide tab →
  Mitigation: two columns only (`transferred_amount`, `transfer_verified`);
  header change is backward compatible (append-only).

## Migration Plan

1. Verify `created_by` on the 4 tabs (read-only check, no deploy).
2. Deploy A+B (guards + audit trail). Existing PENDING rows unaffected.
3. Deploy D+E (optional columns + confirmation payload). Old clients sending
   no amounts keep working.
4. Deploy C+F (UI label + resend). No rollback concerns; all changes are
   additive. Rollback = revert commit; no data migration to undo.

## Open Questions

- None blocking. Payroll-table UI already reads `locked_status`; confirm the
  same table surfaces `transfer_verified` and the BPJS notice without a second
  design pass during implementation.
