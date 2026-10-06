# Proposal: HR Master-Data Real Outlets & Status

## Why

Client review (2026-10): outlet location lists still contain dummy seeded outlets and employee statuses hold dummy/variant values. Requested reality: exactly four outlets — Sekar Pizza Tirtodipuran, Sekar Pizza Colombo, Funkydak Colombo, Suburbun — and employment statuses limited to Probation / Permanent / Contract. UI is fully data-driven, so this is one part labels, one part production data migration.

## What Changes

- One-shot idempotent migration script `scripts/fix-master-data.ts` (`npm run sheets:fix-master-data`, dry-run by default, `--apply` for writes): upserts the 4 real outlets (keep existing OL ids where known, append missing `Sekar Pizza Colombo`), deactivates all other outlet rows, normalizes `master_employee.employment_status` variants (TETAP/PERMANENT/KONTRAK/PROBASI/PKWT/…) to canonical `PROBATION|PERMANENT|CONTRACT`, leaves genuinely unknown values untouched (reported), and audit-logs the run.
- UI dropdown option lists (attendance page; status labels in employees table + employee form) show only canonical/active data: outlet options filtered to `active_status=active` while display maps keep historic rows; status labels rendered exactly `Probation / Permanent / Contract` (stored tokens unchanged — engine keeps reading uppercase tokens).
- Pure helpers live in `src/lib/master-data.ts` (unit-testable) — script is a thin runner.

## Capabilities

### New Capabilities
- `hr/master-data-realoutlets`: the canonical outlet list (4 real locations) and the closed set of employment statuses with label mapping.

### Modified Capabilities
(none)

## Impact

- Files: `ykp-hr-v1/scripts/fix-master-data.ts` (new), `src/lib/master-data.ts` (new), `src/app/hr/attendance/page.tsx`, `src/features/hr/components/employees-table.tsx`, `src/features/hr/components/employee-form.tsx`, `package.json` (npm script).
- Production run required: `npm run sheets:fix-master-data -- --apply` inside the hr-v1 service (env creds live there). Dry-run prints the plan safely first.
- Engine behavior untouched (status tokens + outlet ids preserved); reminders/geo continue reading raw tabs.