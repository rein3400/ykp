# Design & Tasks — HR Master-Data Real Outlets

## Decisions

1. **Data-driven UI already** — dummy-ness lives in Sheets rows; fix = migration + filter active rows on PICKERS only (display maps keep all rows so historic attendance/roster still render names). Engine reads (assertOutlet, geo resolve, summary) stay unfiltered — deactivation must not break old row resolution.
2. **Stable ids**: reuse OL-011 (Funkydak Colombo), OL-012 (Sekar Pizza Tirtodipuran), OL-013 (Suburbun; renamed from Suburbuns Colombo per client wording), append OL-014 Sekar Pizza Colombo. Brand mapping kept from existing rows (Sekarpizza BR-002, Funkydak BR-001, Suburbuns BR-003). Coords/radius left blank — owner fills (they're needed for bot GPS; never invent coordinates).
3. **Migration = thin runner over pure lib** (`src/lib/master-data.ts`) for unit tests; dry-run default + `--apply`; refuses mock/postgres modes; `logAudit` per change with before/after.
4. **Tokens stay uppercase** (PROBATION/PERMANENT/CONTRACT) — engine + reminders depend on them; labels displayed Title-case per client wording.
