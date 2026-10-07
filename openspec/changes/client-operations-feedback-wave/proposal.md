## Why

Client acceptance feedback exposes inconsistent outlet filtering, divergent Telegram attendance paths, missing leave rejection explanations, incomplete Warehouse conversion/alert configuration, and a cash-oriented Ops closing screen that does not match the requested opening-checklist workflow. Persisted seed data must be distinguished from real operational history before cleanup.

## What Changes

- HR: role-authorized multi-outlet attendance with mandatory geofencing and recorded actual outlet; outlet codes visible; canonical employment categories; Telegram rejection reasons; guarded deletion of unreferenced mistaken employee records.
- Finance: active operational outlet filters across overview, analytics and daily reporting while preserving financial obligations and historical views.
- Warehouse: finite validated physical-unit conversion autofill with manual packaging factors; explicit Ops-supervisor stock alert routing; reviewed dummy-data cleanup.
- **BREAKING**: Ops closing input becomes template-based checklist reporting rather than manual cash/revenue entry; preserve old closing history and Finance/Moka revenue ownership.
- Ops: WIB current-date display and Telegram reporting menu for approved operational capabilities, using the same domain validation as web submissions.
- Provenance-first cleanup across all dashboards: backup, explicit preimage manifest, dependency checks and post-apply reconciliation. Ambiguous records are never automatically deleted.
- Exclude staff-access cutover and Finance mobile-login investigation per owner instruction. SMTP account provisioning awaits Deva and is not fabricated.

## Capabilities

### New Capabilities

- `platform/client-operations-feedback`: client acceptance contracts for scoped HR attendance, Warehouse configuration, Ops checklist/Telegram reports and provenance-aware cleanup.

### Modified Capabilities

None; active-outlet integrity work is reused without replacing historical/audit contracts.

## Impact

HR/Finance/Warehouse/Ops web pages, APIs, Telegram handlers, tests, reviewed migration tooling and runtime script assets. Owner/Investor summary consumers must remain consistent with producer filtering. No global deletion, employee-name uniqueness, credential files, or automatic destructive deploy hooks.
