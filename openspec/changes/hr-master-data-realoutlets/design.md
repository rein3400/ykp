# Design & Tasks — HR Master-Data Real Outlets

## Decisions

1. **Data-driven UI already** — dummy-ness lives in Sheets rows; fix = migration + filter active rows on PICKERS only (display maps keep all rows so historic attendance/roster still render names). Engine reads (assertOutlet, geo resolve, summary) stay unfiltered — deactivation must not break old row resolution.
2. **Stable ids**: match live outlet names and explicit spelling aliases, preserve matched IDs and GPS fields, allocate unused sequential IDs only for missing outlets. Resolve brand IDs from unique live brand names; reject ambiguous outlet matches or brand mismatches. Use the schema column `status` (not employee `active_status`). Apply refuses deactivation while active employees/users reference affected outlets; reconcile their assignments before retrying. Writes are sequential, not transactional: run one migration at a time without concurrent master-data edits, inspect dry-run, and retry after partial failures. Never invent coordinates.
3. **Migration = thin runner over pure lib** (`src/lib/master-data.ts`) for unit tests; dry-run default + `--apply`; refuses mock/postgres modes; `logAudit` per change with before/after.
4. **Tokens stay uppercase** (PROBATION/PERMANENT/CONTRACT) — engine + reminders depend on them; labels displayed Title-case per client wording.
