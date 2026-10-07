# Client Operations Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Deliver the approved HR, Finance, Warehouse and Ops client feedback without deleting real history or weakening authorization.

**Architecture:** Share attendance and checklist domain validation between web and Telegram. Treat dummy cleanup as a separately reviewed backup/preimage-manifest operation, never a deploy-time seed reset. Each module slice gets regression tests and a commit before rollout.

**Tech Stack:** Next.js, TypeScript, Vitest, Google Sheets/Postgres adapters, Telegram, existing SMTP infrastructure.

**Spec:** `openspec/changes/client-operations-feedback-wave/design.md`

## Global Constraints

- Mobile Finance login and staff-access cutover are excluded.
- Store implementation/tests/deployment records in Git, never secrets or PII backup contents.
- No arbitrary removal/cascade of payroll, stock ledger, invoices or audit history.
- kg→g=1000; g→kg=0.001; l→ml=1000; ml→l=0.001. No generic mass-volume conversion.
- Keep active/inactive lifecycle separate from PROBATION/PERMANENT/CONTRACT.
- Closing reuses Opening interaction, not its outlet fallback or storage assumptions; no revenue/cash input.

## Review Focus

- User rows can have both user_id and employee_id: use table-specific identity.
- Employee changes home outlet after clock-in: checkout must use recorded attendance outlet.
- Names and seed IDs can belong to real records: manifest provenance/preimages are mandatory.
- Failed Telegram send must not roll back persisted leave decisions or duplicate mutations on retry.
- Shared workbooks/header drift must not be overwritten by bootstrap or cleanup.

### Task 1: Warehouse physical/manual conversion

**Files:** create `ykp-warehouse-v1/src/lib/unit-conversion.ts` and `.test.ts`; modify `src/app/warehouse/unit-conversion/unit-conversion-client.tsx`, `src/app/api/warehouse/unit-conversion/route.ts`.
**Interfaces:** `fixedConversionFactor(from: string, to: string): number | null`; `validateConversionFactor(from: string, to: string, factor: unknown): number` throws validation errors; null fixed factor keeps packaging manually editable.

- [ ] Write table tests for kg/g, gram/gr aliases, l/liter/ml, same unit, box→g null, kg→ml null, nonfinite/zero/negative and wrong fixed factor rejection.
- [ ] Run focused Vitest and observe failure before helper exists.
- [ ] Implement pure normalization/factor helper; wire controlled form unit changes to fixed autofill and read-only fixed factor, preserving manual packaging entry. Validate finite positive factors and enforce known physical factors server-side; validate duplicate active item/from/to definitions before append.
- [ ] Run Warehouse lint/typecheck/full tests, inspect actual transaction consumers and state explicitly if stock normalization remains separate.
- [ ] Commit the slice; do not rewrite existing conversion data automatically.

### Task 2: HR leave rejection explanation

**Files:** `ykp-hr-v1/src/app/api/hr/leaves/approve/route.ts`; `src/app/api/hr/attendance/telegram/route.ts`; `src/app/api/hr/telegram/me/route.ts`; pure formatter tests and approval route tests.
**Interfaces:** decision mutation requires nonblank trimmed reason for rejection and scoped target employee; bot representation exposes an HTML-escaped reason for REJECTED leave only.

- [ ] Add failing tests for blank direct API rejection, other-outlet approval, rejection reason containing HTML and successful decision with failed notification.
- [ ] Implement server validation and approver scope; clear stale reason on approval. Display reason in linked-user and legacy bot paths. Send post-commit decision notification to the active linked account; log delivery status and expose retry without repeated decision writes.
- [ ] Run HR lint/typecheck/tests and commit.

### Task 3: HR master UI and guarded deletion

**Files:** `src/features/hr/components/employee-form.tsx`, `employees-table.tsx`, employee create/edit pages and `src/app/api/hr/employees/[id]/route.ts`; create reference/deletion policy module and tests in HR.
**Interfaces:** form receives authorized active brand/outlet rows and displays `name — outlet_code (outlet_id)`; removal eligibility returns blocking domain names from enumerated employee references.

- [ ] Test canonical category labels separately from activity, same-name different-identity creation, invalid brand/outlet pairs, unused accidental record removal, and refusal for every referenced domain including user/supervisor/replacement links.
- [ ] Replace manual outlet ID entry/hardcoded brands with real scoped masters; validate master relationship server-side.
- [ ] Investigate actual storage delete support and physical identities; if no safe audited backend delete contract exists, stop the DELETE portion rather than implement clear-and-rewrite/cascade. Add HR-authorized confirmation flow only after unreferenced preimage validation and audit preservation are feasible.
- [ ] Run HR gates and commit safe completed parts, recording the delete blocker if present.

### Task 4: Multi-location attendance unification

**Files:** `src/lib/attendance-service.ts` and tests; Telegram `clock-in`, `clock-out`, webhook route; `src/lib/attendance-geo.ts`; HR user settings/RBAC.
**Interfaces:** one service consumes resolved active user/employee, intended action, selected active outlet and GPS. Checkout resolves existing open attendance outlet; web read scope is independent from multi-location attendance permission.

- [ ] Add failing cases for ordinary home-outlet restriction, authorized roaming role selected outlet, inactive outlet, bad/no GPS, overlapping radius selection, overnight checkout and home-assignment change.
- [ ] Implement explicit role allowlist with owner/HR-controlled opt-in; persist selected actual outlet and audit; remove inconsistent geofence bypasses. Route both bot paths through shared service, preserving existing daily-session model and explicit clock-in/out intent.
- [ ] Join Overview events by actual event outlet and leaves by employee identity; fix multi-day presence/absence units with defined employee-day denominator and approved-leave handling.
- [ ] Run HR gates, check Finance payroll attribution and commit.

### Task 5: Finance operational filters

**Files:** `ykp-finance-v1/src/app/finance/ui.tsx`, `analytics/analytics-client.tsx`, `summary/summary-client.tsx`, producer routes and regression tests.
**Interfaces:** active outlet helper filters current operational choices/aggregates; explicit history and unpaid liabilities remain independently accessible.

- [ ] Add failing tests for analytics picker/comparison, daily all-outlet totals/alerts, inactive-only POS with unpaid invoices and explicit historical closed-outlet data.
- [ ] Apply active eligibility and RBAC consistently; remove stale-date-as-current ambiguity by explicit effective-date display; keep obligations outside POS availability gate.
- [ ] Run Finance lint/typecheck/tests and commit.

### Task 6: Ops template-based Closing

**Files:** `ykp-ops-v1/src/app/ops/opening/opening-client.tsx`, `closing/page.tsx`, `closing/closing-client.tsx`, `src/app/api/ops/closing/route.ts`, `src/db/sheets.ts`, checklist template/submission routes/services and tests.
**Interfaces:** shared checklist selector validates type/active status/outlet/brand; closing submissions store individual template ID, item status, notes/photo, actor, outlet, shift, WIB date and stable submission identity; final aggregate derives status from details.

- [ ] Inspect existing `ops_checklist_submission` schema and exact reference mapping; pin additive required headers without erasing old ops_closing rows.
- [ ] Write failing tests: no cash inputs, CLOSING-only authorized templates, missing scoped templates must not use other-outlet templates, incomplete/critical/photo gates, duplicate event idempotency, complete closing summary derived from details.
- [ ] Extract/reuse Opening interaction with type/endpoint parameters; replace cash-oriented Closing UI/API contract. Add reviewed idempotent Opening→Closing template cloning for missing templates only; preserve owner edits and provenance.
- [ ] Update Ops summaries to read checklist aggregates without inventing cash values. Run Ops lint/typecheck/tests/build and commit.

### Task 7: Briefing and Telegram operational reporting

**Files:** Ops briefing client/API; shared Ops checklist/report services; authenticated Telegram webhook/menu integration and tests; runtime deployment assets.
**Interfaces:** menu identity/activity validation uses existing linked user; selected outlet/shift validated server-side; each operational report delegates to web-domain validation with stable update ID.

- [ ] Pin WIB date display/midnight refresh, date/shift validation, inactive sender refusal, cross-outlet permissions, duplicate webhook delivery and attachment/critical-item validation.
- [ ] Add explicit menu flows for opening, closing, briefing acknowledgement, KDS, QC, incidents, waste and stock issues, using existing report contracts rather than unvalidated arbitrary text writes. Record audit, explicit confirmations/errors and retry state.
- [ ] Run Ops/Telegram integration tests locally with synthetic payloads; do not claim live Telegram delivery until verified with owner test accounts. Commit.

### Task 8: Warehouse threshold rule/recipient integration

**Files:** Warehouse threshold API/client, inventory/rules engine, `src/lib/telegram.ts`, alert persistence/delivery tests.
**Interfaces:** threshold evaluation receives scope/item/units/finite min/max and explicit recipient config; recipient resolution preserves outlet scope and does not silently broadcast on missing target.

- [ ] Write failing low/high boundary, min>max, NaN, duplicate alert, absent recipient and unrelated supervisor routing tests.
- [ ] Connect persisted thresholds to existing inventory rule evaluation, display/configure linked recipient settings for Ops supervisors and log delivery failures safely.
- [ ] Run Warehouse gates, verify conversion units are consistent and commit.

### Task 9: Provenance-aware all-dashboard cleanup and acceptance

**Files:** reviewed inventory/manifest/backup tooling under existing scripts paths; deployment documentation and change tasks; no sensitive artifacts in Git.
**Interfaces:** manifest entries identify backend, table, physical row identity, preimage hash, evidence and dependency closure; apply refuses changed/ambiguous entries, audit deletion or quarantine, reconcile stock/finance totals.

- [ ] Inventory live master/transaction sources read-only per module, including shared workbook ownership; separate explicit seed markers from ambiguous recipes/ordinary IDs.
- [ ] Backup restricted storage before any destructive apply; test missing/changed/duplicate identity and referenced-item/supplier refusal using fixtures.
- [ ] Present exact deletion candidates and dependency effects for owner approval. Do not run global clear/truncate or delete audit history. If provenance is ambiguous, report it rather than claim no dummy remains.
- [ ] Deploy independently tested features source/schema first; perform live outlet UI, GPS, bot rejection, checklist persistence and threshold recipient acceptance. SMTP remains pending Deva credentials.
- [ ] Record actual commit/version per app and unverified items; commit/push intended changes and archive only after acceptance. Fresh-VPS safety remains unproven until authorized staging provisioning is tested.
