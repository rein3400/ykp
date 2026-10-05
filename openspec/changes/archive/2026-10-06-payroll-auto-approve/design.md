# Design — Payroll Auto-Approve

## Context

State machine today (`hr_payroll` rows in the shared Sheets tab): generate → `DRAFT / PENDING / UNPAID / UNLOCKED` (`ykp-hr-v1/src/app/api/hr/payroll/generate/route.ts:181-183`); manual per-row approve → `APPROVED / READY_TO_PAY / LOCKED` (`approve/route.ts:43-62`); Finance excludes non-approved rows from payable (`ykp-finance-v1/src/lib/hr-payroll-bridge.ts:17-21`, pinned by `ykp-finance-v1/tests/payroll-overview.test.ts:72-81`); `needs-revision` rejects `LOCKED` rows with 409 (`needs-revision/route.ts:55`) so auto-approve would previously dead-end the revision path. RBAC: `generate` covers `hr_admin`; `approve` only `owner`/`super_admin` (`src/lib/rbac.ts:53,95,109`). Sheets headers are unchanged (all target columns already exist — no new columns required).

Cross-cutting invariants respected: integer IDR money, `Asia/Jakarta` timestamps, 5xx envelope safety, audit-log per domain, hermez read-only (payroll tab is HR-owned; Finance read-only by design).

## Goals / Non-Goals

**Goals**
- Generate = terminal pre-payment state (locked, payable) in one request; no second button on the happy path.
- Keep owner unlock as the single escalation hatch; keep revision usable for locked rows.
- Zero schema migration (no new Sheets headers); zero Finance code changes beyond copy.
- Preserve audit clarity: one `generate` event records the combined generate+approve roles.

**Non-Goals**
- No config toggle (owner chose unconditional auto-approve; a toggle can be added post-pilot if ever needed).
- No redesign of adjustments approval (owner approve for Bonus/Potongan stays — different scope from client feedback).
- No change to the SoD guard work for adjustments/leaves/lateness in `payroll-hardening`; only its payroll portion is narrowed.
- No backfill of legacy `PENDING` rows (they stay excluded from Finance queue; the legacy approve route still works on them).

## Decisions

1. **Generate route performs the full transition in one request** (set `APPROVED`, `READY_TO_PAY`, `LOCKED`, `approved_by/approved_at` at upsert time) rather than chaining a second internal approve call.
   - *Why:* one Sheets write batch per row, no partial states if the second call failed; atomicity matches the client's "Generate → langsung kunci" ask.
   - *Alternatives:* (a) generate auto-calls approve endpoint per row — doubles Sheets writes and audit noise; (b) env-gated auto-approve — rejected by owner decision.
2. **Audit semantics: single `generate` event, `approved_by = actor`.** The row is honest that one user did both; the alternative fake "two-step" audit trail was rejected (payroll-hardening's before/after trail still applies to the figures).
3. **Keep `/api/hr/payroll/approve` route.** Idempotent for `APPROVED` unlocked rows; still useful for legacy `PENDING` rows minted before deploy. UI removes the button — route surface stays stable for Finance-side tooling and tests.
4. **`needs-revision` unlocks on transition.** With auto-approve, every generated row is locked, so the old 409-on-locked rule would make the Finance "Minta Revisi" path unusable → allow when `payment_status ≠ PAID`, set `NEEDS_REVISION + UNLOCKED`; PAID stays 409. Revision then lets HR edit/regenerate the row.
5. **SoD scoping.** Payroll-hardening's "Separation of duties on HR approvals" requirement will be edited (in that change's delta spec) to exclude the payroll approve/generate action, with the rationale recorded. Adjustments/leaves/lateness keep the guard — a different actor-set and lower automation risk. Edit happens inside this change's apply phase (artifact edit of a sibling change), flagged in tasks.
6. **Finance copy update only** ("menunggu review HR" wording becomes "di-approve otomatis oleh HR" style); `payableOf()` logic untouched — `APPROVED` already payable, `PENDING` exclusion retained for legacy rows.

## Risks / Trade-offs

- [Self-approval governance] Generator = approver by design → Mitigation: audit entry records combined action; owner unlock + Finance "Minta Revisi" remain corrective paths; `payroll-hardening` regenerate before/after trail (separate scope) adds figure-change traceability.
- [accidental mass generation] One misclick generates the whole period as payable → Mitigation: generate page already requires period confirmation + shows affected employee count; existing 409-on-locked keeps paid history immutable.
- [legacy mixed statuses] Old `PENDING` rows still need manual approve → Mitigation: legacy approve route kept; UI: keep a small "legacy rows" path by rendering approve only for rows with `approval_status=PENDING` (data-driven, disappears naturally as data rolls forward).
- [needs-revision unlocking rows] An unlocked `NEEDS_REVISION` row is editable → Mitigation: by design only unpaid rows; any regeneration re-locks (auto-approve path); reason mandatory.

## Migration Plan

1. Merge/approve this change; deploy hr-v1 (Coolify + Vercel + Railway follow-ups are app-wide, no special ordering needed against finance-v1 because finance reads live values with no schema change).
2. No data migration. Legacy `PENDING` rows stay as-is; approve them via the kept route or leave for regeneration.
3. Rollback strategy: deploy previous image; rows already generated stay `APPROVED` (valid under both versions); Finance payable predicate unchanged across versions, so mixed status is safe.

## Open Questions

(none — product decision resolved 2026-10-05: option 1, unconditional auto-approve.)