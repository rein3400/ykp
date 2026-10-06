## Context

See proposal.md for motivation. V1 modules have independent manifests and configurable storage backends; spreadsheet configuration slots do not prove distinct physical workbooks. HR and Finance already disagree on outlet eligibility, Owner consumes persisted upstream summaries, and several stores select mock before checking Postgres. A universal readTab filter would corrupt historical reporting and reference resolution.

## Goals / Non-Goals

**Goals:** enforce consistent operational selection and truthful production data without changing financial ledger history, authentication scope, stable IDs, or storage schema.

**Non-Goals:** erase historic records; infer dummy transactions from names; hardcode four HR IDs into unrelated workbooks; silently exclude invoices/payables owed by closed outlets; add cross-module packages/dependencies.

## Decisions

1. **Module-local eligibility adapters, one tested policy.** Normalize `master_outlet.status` by trim/lowercase; `active` and `1` are operational. Blank, inactive, and pilot do not qualify in production. Reconcile pilot/blank masters during read-only preflight and explicitly activate real outlets before cutover. Preserve role/brand scope. Do not filter storage primitives globally. Alternative: global readTab filtering rejected because audit, foreign references, and historical reports require inactive rows.
2. **Separate operational filters from history.** Pickers, current outlet counts and outlet-attributable KPIs use active IDs. Historical report/audit routes retain all records. Financial obligations remain visible regardless of outlet closure; the active-outlet filter must not hide unpaid payroll, expenses, or liabilities. Brand/global rows without outlet attribution are retained as explicitly scoped global data, not guessed to be dummy.
3. **Filter upstream summaries before aggregation.** HR/Finance/Ops operational summary responses exclude inactive outlet rows, including previously persisted daily summaries. Owner and Investor consume these filtered sources; legacy responses lacking lifecycle metadata require authoritative lookup in the producing module, not guessing downstream. Preserve known response envelopes and document any additive availability metadata.
4. **Backend selection is explicit and consistent.** Postgres wins when configured/enabled. Mock fixtures are permitted in development/test; production implicit/explicit mock selection is rejected with a sanitized configuration error. A failed live backend is never replaced with mock data. Owner all-upstream failure produces unavailable module results and no fabricated overview. Alternative: visible mock banner rejected for production because synthetic financial figures remain misleading even with a banner.
5. **Truthful failure semantics.** Empty successfully read data is zero/empty. Failed reads are unavailable; partial data is labeled partial and missing modules identified. Warehouse finance KPI must distinguish unavailable from genuine zero; optional legacy-table fallback must not substitute demo fixtures.
6. **Read-only preflight before deployment.** Inspect effective backend modes without printing secrets, master outlet statuses/IDs, shared spreadsheet ownership, and seeded operational records. Produce an explicit candidate cleanup list for owner review. Real-vs-dummy attribution beyond outlet lifecycle requires owner approval; code must not auto-delete or reassign records.

## Risks / Trade-offs

- [Removing fallback reveals existing configuration failures] → validate configured real backend before deployment; retain development fixtures; render sanitized unavailable state instead of plausible values.
- [Blank/pilot outlet status may represent real locations] → preflight and owner-confirmed status correction before cutover; no inferred activation.
- [Closed outlets can still have debts] → payment/obligation queues are excluded from operational suppression; retain audit/history.
- [Separate workbooks or shared header ownership] → inventory actual storage configuration; no blanket cross-module master migration or bootstrap.
- [Data remains seeded but lacks provenance] → flag candidates for explicit confirmation; do not promise removal of every dummy transaction through status filtering alone.

## Migration Plan

1. Inspect all module data sources and master lifecycle values read-only; verify prerequisites and capture safe counts, never credentials.
2. Implement and test HR/Finance picker plus KPI behavior first; then summary producers and Owner/Investor consumers; then Warehouse/Ops and backend guards.
3. Run lint, typecheck, full tests and relevant builds independently for each changed app. Verify active/nonactive/global/history/obligation/RBAC scenarios.
4. Deploy source producers before consumers. Smoke-check real-data/partial/unavailable states, four confirmed HR outlets, and no production mock banners/figures.
5. Any data correction is a separately reviewed dry-run/apply with audit and stable IDs preserved. Archive only after live verification.
6. Rollback images if deployment fails; do not roll back real ledgers or master-data changes automatically. Restore previous behavior only with explicit recognition that old images may expose seeded fallback.
