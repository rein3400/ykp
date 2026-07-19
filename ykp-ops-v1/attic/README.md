# Attic — CRUD Layer (pending re-integration)

> **Status: QUARANTINED — not compiled, not deployed.**
> Date: 2026-07-19. Reason: architectural fork in ops-v1.

## What happened

Two implementations of `ykp-ops-v1` were built in parallel on divergent data models:

| | **Live version** (origin/main, restored) | **CRUD layer** (this attic) |
|---|---|---|
| Data model | `ops_closing`, `ops_waste`, `ops_incident`, `ops_kds_order`, `ops_qc_score` | `ops_closing_checklist`, `ops_cash_reconciliation`, `ops_waste_log`, `ops_alert_log`, `ops_action_tracker`, `ops_receipts`, `ops_attachments` |
| Features | AI suite: ai-assistant, KDS, QC scoring, ai-vision, ai-incident, analytics | Operational CRUD: actions, alerts, attachments (Drive photos), receipts, settings, summary engine, daily-brief telegram, 9 vitest suites |
| Shared libs | `repo` (getBrandName/getOutletName), `findRow().rowIndex`, `audit(actorUserId/actorRole)` | `repo` (nextSequentialIdSync/MissingRefError), `findRow().rowNumber`, `audit(module/recordType/userId)` |

The two share helper names (`readTab`, `appendRows`, `findRow`, `updateRow`, `format`, `http`, `session`, `rbac`, `audit`) but with **incompatible shapes** — a mechanical merge compiled cleanly for neither side.

## What is here

The complete cb62d59 CRUD layer, preserved verbatim for deliberate porting:

- `src/app/api/ops/{actions,alerts,attachments,audit,closing,notify,opening,receipts,settings,summary,waste}` — new API routes
- `src/app/ops/{actions,alerts,receipts,settings,summary}` — new pages
- `src/components/photo-upload.tsx`
- `src/lib/{alert-engine,alert-rules,cash,checklist,constants,cron,drive,password,ratelimit,summary-engine,telegram,thresholds,waste}.ts`
- `src/middleware.ts` (CSP + CORS + tiered rate-limit)
- `tests/` — 9 vitest suites (alert-rules, cash, checklist, cron, password, ratelimit, summary-engine, telegram, waste)

## Re-integration checklist (owner decision required)

1. **Pick the canonical data model.** The live AI suite and this CRUD layer use different physical tabs. Either:
   - (a) map the CRUD layer onto the live tabs (`ops_incident`, `ops_waste`, `ops_closing`) — needs new alert/action/receipt tabs added to `src/db/sheets.ts`, or
   - (b) migrate the AI suite onto the CRUD tabs — larger, not recommended while AI features are experimental.
2. Port the shared-lib shape differences (`findRow` return, `repo` exports, `audit` entry shape) into ONE canonical set — the CRUD layer's shapes match the other V1 apps (warehouse/hr-v1), prefer those.
3. Re-enable routes/pages incrementally with `npx tsc --noEmit` green after each.
4. The 9 vitest suites are directly reusable once the libs are ported.

**Do not delete this attic until the port is done and verified in production.**
