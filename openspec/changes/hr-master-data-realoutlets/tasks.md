
- [x] 1.1 `src/lib/master-data.ts`: `REAL_OUTLETS` (4 rows w/ id/name/brand), `normalizeEmploymentStatus(v)` variant map, `STATUS_LABELS`
- [x] 1.2 `scripts/fix-master-data.ts`: dry-run plan + `--apply` upsert/deactivate + status normalize + audit; refuses mock mode
- [x] 1.3 npm script `sheets:fix-master-data`
- [x] 1.4 UI: attendance page outlet options active-only; employees-table + employee-form label maps (Probation/Permanent/Contract)
- [x] 1.5 Tests `master-data.test.ts`: mapping table (variants → canonical; unknown untouched), outlet list shape (4, unique ids)
- [x] 1.6 tsc + lint + vitest green; print runbook for prod run (dry-run → apply)