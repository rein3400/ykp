## Why

Production dashboards still expose inactive seeded outlets, and some modules can silently substitute seeded mock data when configuration or upstream services fail. This can mislead the client even after the HR master-data migration has correctly deactivated old outlets.

## What Changes

- Filter operational outlet pickers and outlet-attributable dashboard KPIs by authoritative active master outlets, preserving RBAC and historical reporting.
- Apply the same eligibility to current summaries consumed by Owner and Investor so inactive/stale outlet summaries do not reappear downstream.
- **BREAKING**: production may not automatically select mock storage or replace unavailable upstream data with seeded values. Development/test demo fixtures remain supported; production errors must be explicit and observable.
- Retain real historical records and inactive masters for audit/reporting. Do not classify employees or transactions as dummy by name, ID, date, or zero value.
- Audit actual backend configuration and master-data mappings per deployed module before any live migration. Reconcile separately configured/shared spreadsheets without overwriting shared headers.

## Capabilities

### New Capabilities

- `platform/operational-data-integrity`: active-outlet operational scope, truthful unavailable/partial states, and no implicit production mock fallback across V1 modules.

### Modified Capabilities

None. Existing HR canonical master-data migration remains a prerequisite, not an authority for other workbooks.

## Impact

HR, Finance, Warehouse, Ops, Investor, Owner, and Hub dashboard consumers, summary producers, backend selection, and regression tests. No new dependencies are required. No automatic deletion, arbitrary employee reassignment, ledger rewriting, or production credential changes are authorized by this change.
