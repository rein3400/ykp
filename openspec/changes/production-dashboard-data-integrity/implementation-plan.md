# Production Dashboard Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate inactive outlet choices and implicit mock figures from operational dashboards while retaining real history and making VPS provisioning repeatable and verifiable.

**Architecture:** Apply module-local lifecycle policies at operational query/summary boundaries, not storage primitives. Keep payment obligations and historical reporting visible. Deploy scripts validate configuration, preserve existing secrets, and fail on incomplete provisioning rather than announcing success.

**Tech Stack:** Next.js, TypeScript, Vitest, Google Sheets/Postgres adapters, Bash, Coolify API.

**Spec:** `openspec/changes/production-dashboard-data-integrity/design.md`

## Global Constraints

- No record deletion, arbitrary employee reassignment, financial ledger rewriting, or credential edits.
- `master_outlet.status`: normalized `active` and `1` are operational; blank/pilot/inactive require explicit reconciliation.
- Preserve RBAC, integer IDR, Asia/Jakarta, stable IDs, and existing audit/reference resolution.
- Production cannot substitute mock fixtures for missing or unavailable live data.
- Closed-outlet liabilities and unpaid payroll remain visible.
- Store intended implementation, regression tests, and deployment changes in Git; never commit secrets.

## Review Focus

- Linked users carry both employee_id and user_id: identity must be table-specific, not a fallback union.
- Historical reports include inactive outlets while operational pickers do not.
- An unavailable financial source is not numeric zero.
- Missing Sheets configuration must not shadow an explicitly configured Postgres backend.
- Re-running provisioning must not rotate session/cron/integration secrets or overwrite shared workbook headers unnoticed.

---

### Task 1: HR operational eligibility

**Files:** `ykp-hr-v1/src/lib/master-data.ts`, its tests; `src/app/hr/page.tsx`, `page.test.tsx`; `src/features/hr/components/hr-overview-client.tsx`; `src/app/hr/users/users-client.tsx`; `src/app/api/hr/summary/regenerate/route.ts`; `src/app/api/hr/summary/route.ts`.

**Interfaces:** consume `isActiveOutletStatus(status: string | undefined): boolean`; supply active outlet IDs to operational clients and public aggregate summaries; leave historical storage/display maps unchanged.

- [ ] Add failing overview/picker tests: active fixture retained, inactive/blank/pilot excluded, brand/outlet RBAC still enforced; historical names still resolve.
- [ ] Run targeted Vitest tests and confirm the current leakage fails.
- [ ] Add outlet status to row types; filter operational outlet choices and outlet-attributable KPI/summary inputs consistently. Keep unscoped/global records explicitly categorized. Users administration keeps historic display mapping but creation picker offers active outlets only.
- [ ] Run lint, `npx tsc --noEmit`, full `npm test`; inspect unpaid payroll/history routes are untouched.
- [ ] Commit only this tested slice.

### Task 2: Finance operational views and summaries

**Files:** `ykp-finance-v1/src/app/finance/page.tsx`, `ui.tsx`, `ringkasan-client.tsx`, `summary/summary-client.tsx`; `src/app/api/finance/summary/route.ts`, `summary/regenerate/route.ts`; module-local eligibility tests.

**Interfaces:** operational selection uses normalized master outlet status; existing summary envelope remains compatible; liabilities/payroll queues are not filtered by outlet lifecycle.

- [ ] Add failing tests for inactive outlets in pickers, all-outlets current KPIs, and persisted summaries; include payable debt at a closed outlet which must remain visible.
- [ ] Reproduce failures with targeted Vitest runs.
- [ ] Use live master outlet IDs for operational eligibility; filter stale daily summaries before returning current operational aggregates; preserve explicit historical reporting and global finance rows.
- [ ] Run app lint, typecheck, tests and review payment queues for accidental suppression.
- [ ] Commit tested Finance slice.

### Task 3: Warehouse/Ops operational data

**Files:** `ykp-warehouse-v1/src/app/warehouse/dashboard/page.tsx`, `closing/closing-client.tsx`, `waste/waste-client.tsx`; `ykp-ops-v1/src/app/ops/page.tsx`, `src/lib/ops-summary.ts`, `src/lib/repo.ts`; corresponding tests.

**Interfaces:** module-local outlet eligibility follows Task 1 policy; unavailable external finance KPI is an explicit nullable/unavailable value, not `0`.

- [ ] Add failing tests for inactive choices/counts and Ops summary production; Warehouse failed finance fetch must display unavailable while successful zero displays zero.
- [ ] Implement lifecycle joins for operational rows, keeping unpaid procurement/history available; retain legacy storage fallback only when it reads real records with observable provenance.
- [ ] Verify lint/typecheck/tests for both apps and commit.

### Task 4: Backend selection and production fallback

**Files:** `src/db/mock-store.ts` and `src/db/sheets.ts` in HR/Finance/Warehouse/Ops/Investor; existing backend/incident tests; `ykp-owner-v1/src/lib/aggregate.ts`, `src/lib/fetch.ts`, overview component/tests.

**Interfaces:** configured Postgres takes precedence; development/test explicit mock remains supported; invalid production backend raises a sanitized configuration error. Owner outage yields unavailable/partial module metadata without synthetic overview.

- [ ] Add table-driven failing tests: production missing credentials, explicit mock in production, development fixtures, Postgres with no Sheets vars, consistent read/update backend, all-upstream outage and partial outage.
- [ ] Correct selection order and reject production mock fallback. Ensure build/static evaluation does not contact production data; validate on runtime data use.
- [ ] Remove Owner all-down mock substitution; preserve error/freshness information and make nullable unavailable KPIs explicit.
- [ ] Run each changed app's manifest-defined lint/typecheck/tests/build, fix new failures, then commit.

### Task 5: Owner/Investor consumer integrity

**Files:** `ykp-owner-v1/src/components/filterable-rows.tsx`, `src/lib/aggregate.ts`; `ykp-investor-v1/src/lib/finance-summary.ts`, `src/db/sheets.ts`, `src/app/investor/page.tsx`; tests.

**Interfaces:** consume filtered operational summaries from Tasks 1–3; do not infer lifecycle from names or mismatched workbook IDs. Explicit history views remain historical.

- [ ] Add tests proving inactive persisted source rows cannot return via operational summary aggregation, partial sources are labeled, optional-table absence differs from permissions/connection failure, and historical views retain rows.
- [ ] Adjust consumers/availability contracts only where producers cannot fully enforce eligibility; keep legacy envelope support without fabricating data.
- [ ] Verify module gates and commit.

### Task 6: Safe repeatable VPS deployment

**Files:** `deploy.sh`; non-secret deployment documentation; new shell smoke tests with mocked Coolify API responses; module Dockerfiles/bootstrap helpers where operational commands require assets.

**Interfaces:** preflight runs before provisioning mutations; existing server/environment app discovery is scoped correctly; failed health/bootstrap returns nonzero. Re-run preserves already configured secrets. Fresh target bootstrap creates required missing tabs non-destructively; header drift blocks with a diagnostic, not an unconditional rewrite.

- [ ] Add shell tests for required command/env presence, app discovery restricted to intended project/environment, existing secret preservation, missing Sheets tab, failing migration, failed module data health, and duplicate execution.
- [ ] Run `bash -n deploy.sh` and shell tests to reproduce current false-success paths.
- [ ] Implement preflight without printing secret values. Reuse existing integration/session secrets instead of generating new ones for existing apps; generate only on initial provisioning with explicit secure persistence/recovery guidance.
- [ ] Replace swallowed migration failures with actionable nonzero results. Do not run outlet reassignment/ledger migrations automatically. Use a missing-tab-only bootstrap mode, verify schemas before modifying shared sheets, and make fresh runtime images include required operational script assets.
- [ ] Await Coolify deployment completion with bounded polling; gate success on module data health/provenance, not login HTTP status alone. Retain internal service aliases and source-before-consumer deployment order.
- [ ] Verify Bash syntax, mocked API tests, Docker/build checks; commit deployment slice. Do not run the full provisioning script against the live VPS merely to test it.

### Task 7: Production preflight, rollout, and acceptance

**Files:** OpenSpec tasks, deployment notes and non-secret provenance report; no credentials included.

- [ ] Read-only inventory each app's effective backend, workbook sharing, active master IDs and unknown seeded operational records; request explicit owner decisions for ambiguous rows rather than classifying by name.
- [ ] Correct live master statuses only using reviewed dry-run migrations with audit; never delete historical records.
- [ ] Deploy tested producers then consumers to the current VPS; record actual successful commit/version per app.
- [ ] Verify HR dropdown contains the four confirmed active outlets, Finance/Ops/Warehouse operational views agree with their authoritative master, Owner/Investor reflect source data, and Hub data health is healthy or explicitly partial.
- [ ] Validate new-VPS repeatability with mocked provisioning plus a separately authorized staging target; do not claim a real clean-VPS deployment was tested if only local shell tests ran.
- [ ] Record all remaining live blockers honestly; archive only after acceptance. Commit/push intended changes without credential artifacts.
