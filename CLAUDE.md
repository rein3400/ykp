# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Monorepo for YKP Hermez AI Command Center — three independent tracks plus shared infra, all parked or scoped per the decisions below. Full status + per-track deliverables in `PROGRESS.md`.

| Track | Path | Port | Status |
|---|---|---|---|
| A — ICT trading orchestrator | `orchestrator/` | API `3001`, dashboard `/dashboard` | deprioritized; smoke-clean, infra-only work paused |
| B-OLD — ykp-erp monorepo | `ykp-erp/` | HR `3002`, Finance `3003`, Hermez `3004` | **parked** 2026-07-07 (14 CRITICAL/HIGH residuals, no fix loop). See `ykp-erp/YKP_ERP_V1_FINAL.md` |
| B-NEW — HR V1 (Google Sheets) | `ykp-hr-v1/` | `3002` | **active**. Awaiting owner: GCP service account, data pack, then 7-day pilot. Steps in `ykp-hr-v1/PILOT-CHECKLIST.md` |
| B-NEW — Finance V1 (Google Sheets) | `ykp-finance-v1/` | `3003` | active, mirrors hr-v1 Sheets pattern |
| B-NEW — Warehouse V1 (Sheets, 37 tabs) | `ykp-warehouse-v1/` | `3005` | active, inventory-engine 40/40 tests |
| B-NEW — Ops V1 (Sheets + AI) | `ykp-ops-v1/` | `3007` | active |
| B-NEW — Investor V1 (Sheets) | `ykp-investor-v1/` | `3006` | active |
| B-NEW — Owner V1 (aggregator, no Sheets) | `ykp-owner-v1/` | `3010` | active, aggregates other V1s |
| Hub (reverse-proxy) + Hermez bot | `ykp-hub/` (`3000`), `ykp-hermez/` (Telegram) | `3000` | hub rewrites to finance/hr/hermez; hermez is TS-only aggregator |
| Infra | `mt5-bridge-service/`, NSSM-managed Windows services, Cloudflare Tunnel | — | deployed for orchestrator; B4 + C1-C4 pending for Track A |

Source briefs live at repo root: `HERMES_AI_SRI_ICT_Developer_Brief.txt` (Track A), `YKP_ERP_HR_Developer_Brief_V1.txt` / `YKP_ERP_Finance_Developer_Brief_V1.txt` / `YKP_ERP_Operational_Developer_Brief_V1.txt` (Track B), `YKP_ERP_Roadmap_Phase1_Migration_Brief.pdf` + `YKP_Hermez_Developer_Brief_Migration_V1.docx` (foundational).

`.backup_ykp-demo_2026-07-03/` is a stale Clerk-based Next.js starter snapshot used during recon; do not develop against it.

> **Port collision:** `ykp-erp/apps/hr` and `ykp-hr-v1` both bind `3002`; `ykp-erp/apps/finance` and `ykp-finance-v1` both bind `3003`. Run one at a time.

---

## Per-track commands

### `orchestrator/` — Node 22 + Fastify 5 + Drizzle + grammy + Qdrant

```bash
npm install
docker compose up -d postgres redis                    # or --profile ollama for local LLM
cp .env.example .env && $EDITOR .env                  # TELEGRAM_*, OPENAI_API_KEY, TRADINGVIEW_WEBHOOK_SECRET, DATABASE_URL
npm run db:migrate                                    # pg_advisory_xact_lock-guarded, idempotent
npm run db:seed
npm run dev        # API on http://localhost:3001
npm run worker     # BullMQ scheduler + Telegram bot (long-poll, or webhook if TELEGRAM_WEBHOOK_MODE=true)
npm test           # vitest (scoring, risk, session, mt5-mock, approval, circuit-breaker, metrics, knowledge-search)
npm run lint       # tsc --noEmit (type-only gate; no eslint configured)
npm run build      # tsc compile
npm run db:generate# drizzle-kit generate
```

Production (Option A — Windows host): copy `.env.prod.example` → `.env.prod`, `docker compose up -d --build`. NSSM services: `YKPMT5Bridge` (native Win, MT5 SDK is Windows-only) + `YKPCloudflared`. See `orchestrator/README.md` for secret-rotation order and start sequence.

### `ykp-erp/` — Node 20 + Next.js 14 + npm workspaces + Drizzle + BullMQ

```bash
npm install
docker compose up -d                                  # postgres:17 + redis:7
cp .env.example .env && $EDITOR .env                  # YKP_{MASTER,HR,FINANCE,HERMEZ}_DATABASE_URL, REDIS_URL
npm run db:generate                                   # drizzle-kit generate for each schema bundle
npm run db:migrate                                    # scripts/migrate.mjs → tsx packages/schema/src/migrate.ts → 4 DBs sequentially under pg_advisory_xact_lock(74213721)
npm run db:seed
npm run dev                                           # concurrently runs hr + finance + hermez
npm test                                              # vitest in apps/{hr,finance,hermez}
npm run lint                                          # tsx typecheck across workspaces
npm run typecheck
npm run build
npm run smoke                                         # scripts/smoke.mjs pings all 4 DBs + Redis
```

Workspace layout (`packages/`): `schema` (per-DB Drizzle schemas + advisory-locked migrator), `engine` (pure calculators: payroll, attendance, hr/fin-summary, moka-importer, approval, hermez-brief + 7 triggers, cron, telegram, audit, id-gen, lookup), `ui`, `auth`, `config`, `format`. Workspace dependency direction: `apps → engine/format/ui/auth → config`; `schema` is consumed only by `engine` and `apps/*` server side. `format` is a leaf (only depends on `config`).

### `ykp-hr-v1/` — Next.js 16 + Google Sheets API

```bash
npm install
# 1. docs/GOOGLE-SHEETS-SETUP.md: GCP service account, share spreadsheet as Editor
cp .env.example .env && $EDITOR .env                  # GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (\\n literal), YKP_HR_SPREADSHEET_ID, SESSION_SECRET (>=32 chars)
npm run sheets:bootstrap                              # idempotent: create 17 tabs + seed brands/roles/leave_types/lateness_rules
npm run sheets:smoke                                  # write+read roundtrip
npm run sheets:seed-user                              # default owner/owner123 — CHANGE before pilot
npm test                                              # vitest (payroll + summary engine, 7/7)
npm run dev                                           # http://localhost:3002
npm run build
npm run lint                                          # oxlint
```

DB layer: `src/db/sheets.ts` (googleapis JWT client, `TABS`/`TAB_HEADERS`, `readTab`/`appendRows`/`updateRow`/`findRow`). FK validation in app layer at `src/lib/repo.ts` (assertBrand/assertOutlet/assertEmployee/assertShift → MissingRefError → 400). IDs sequential per prefix via `nextSequentialId`. 9 sections per brief §6 in `src/app/hr/`. Hermez-facing read: `GET /api/hr/summary?date=` (public allowlist in `middleware.ts`).

### `mt5-bridge-service/` — Python 3.11 + FastAPI (Windows-only SDK)

```bash
python -m venv .venv && .venv\Scripts\activate
pip install -e .                                       # MetaTrader5 5.0.45 SDK, fastapi, uvicorn, pydantic
nssm install YKPMT5Bridge                              # NSSM wrapper script in scripts/nssm/
```

Native Windows service. Containerized bridge is impossible — MT5 SDK is Windows-only. Orchestrator reaches it at `MT5_BRIDGE_URL=http://host.docker.internal:8765` with `MT5_BRIDGE_TOKEN` Bearer. Endpoint contract in `orchestrator/src/modules/mt5-http-bridge.ts`. One process per MT5 account (race + global state otherwise).

---

## Big-picture architecture

### Three tracks, three databases strategies

| Track | Storage | Why |
|---|---|---|
| orchestrator | 1 Postgres `ykp` (Drizzle) + Redis + Qdrant | single-DB, vector sidecar |
| ykp-erp | 1 Postgres, **4 schemas** (`master` / `hr` / `finance` / `hermez`) via single `YKP_DATABASE_URL` (refactored from 4 DBs for Supabase free-tier) | cross-schema FK still impossible in PG; app-layer validates master refs (`packages/schema/src/db/clients.ts`) |
| ykp-hr-v1 | Google Sheets (17 tabs, header row 1) | brief V1 allowed; 60 writes/min quota ok for 5-10 staff × 7-day pilot |

### Cross-cutting invariants (enforced everywhere)

These are global to the whole workspace — verify any new code respects them before merging:

1. **Hermez is read-only** against HR/Finance tables. `ykp-erp/apps/hermez/src/lib/no-write-back.ts` enumerates forbidden tables; write boundary always returns `HERMEZ_WRITEBACK_ENABLED === "true"` check. Engine side: `packages/engine/src/hermez-brief.ts:9-13` and `lookup.ts` read-only paths.
2. **Currency = integer IDR**. All money columns typed `integer().default(0)`. CSV/Moka parsers strip `Rp`/`.`/`,`. No decimals anywhere. Display via `formatIdr(n)` → `Rp 1.234.567`.
3. **Timezone = `Asia/Jakarta`**. Single source: `ykp-erp/packages/config/src/index.ts:7` `TZ = "Asia/Jakarta"`. Cascaded to docker `TZ/PGTZ`, Postgres default, `master_outlet.timezone`, all `Intl.DateTimeFormat` calls. Cron: `HERMEZ_RUN_HOUR_UTC=15` (= 22:00 WIB); retry queue `+15min`.
4. **Stable prefixed IDs** (`BR-NNN`, `OL-NNN`, `EMP-NNNNN`, `SUP-NNNN`, date-encoded dailies `HRR-OL-YYYYMMDD-NNN`, `FIN-YYYYMMDD[-OL]-NNN`, `HZBR-YYYYMMDD`, `HZAL-YYYYMMDD-NNN`). Single source: `ykp-erp/packages/engine/src/id-gen.ts`. Storage column is `TEXT` PK (not bigserial) so app layer owns ID. `bigserial` only used for `audit_log.id`.
5. **Auth = 24h HS256 cookie** (`ykp_session`), `NEXTAUTH_SECRET` >=32 chars, strict SameSite, httpOnly. ykp-hr-v1 parallels this in `src/lib/session.ts`. RBAC matrix in `ykp-erp/packages/auth/src/rbac.ts` (8 roles) and `ykp-hr-v1/src/lib/rbac.ts` (9 roles).
6. **No shell**, always `spawn(cmd, args, { shell:false })`. See `ykp-erp/scripts/migrate.mjs`.
7. **5xx never leaks stack**. `ykp-erp/apps/{hr,finance,hermez}/src/app/api` uses envelope `{data}` / `{error:{code,message}}`. ykp-hr-v1 `src/lib/http.ts` same shape.
8. **Audit log per domain DB** (`master_audit_log` / `hr_audit_log` / `finance_audit_log` / `hermez_audit_log`) — no cross-DB writes required; emitter `packages/engine/src/audit.ts`. ykp-hr-v1 writes only to `audit_log` Sheets tab, idempotent + best-effort (never breaks main op).
9. **Migrations are advisory-locked**. `pg_advisory_xact_lock(74213721)` so API and worker can both migrate on startup safely.
10. **Hermez DB has no production writeback path**. `HERMEZ_WRITEBACK_ENABLED=false` is hard-coded in `no-write-back.ts:30`; surfacing flag lives in `engineHealth()`.

### Orchestrator module wiring (read these to extend)

- HTTP entry: `orchestrator/src/index.ts` → migrations → Fastify → listen. Worker entry: `orchestrator/src/worker-entry.ts` → migrations → env owner → BullMQ workers → Telegram bot (webhook if configured else long-poll).
- Fastify assembly: `orchestrator/src/app.ts:10-108` helmet + CORS + rate-limit + static `dashboard/` + lazy `registerRoutes()`.
- Domain flow: `trading-view webhook → trading-engine.ts → scoring → session-filter + news-filter → risk-manager → approval → telegram signal → on APPROVED → trade-executor → mt5-bridge`. Persistent lifecycle logged in `trading_journal`, `trade_executions`, `audit_logs`. Circuit-breaker wraps MT5 HTTP calls.
- RAG: `knowledge-ingest.ts` → `embeddings` (OpenAI 1536 / Ollama 768) → Qdrant. `knowledge-search.ts` consumed by `sop-bot`. Use `EMBED_PROVIDER` env to pick a collection; never mix dims.
- 5 agents live in `modules/agents.ts` — system prompts only; routed via `ai-router.ts` `taskType` (no separate processes).

### YKP ERP package dependency rules (enforce with import lint)

```
apps/{hr,finance,hermez}
   ↓ uses
packages/engine ← depends on packages/schema (Drizzle)
                  ↓ depends on
              packages/format (leaf) ─→ packages/config (leaf)
packages/ui / packages/auth / packages/config            ← leaf-ish
```

`packages/engine` is the only domain-logic place; apps orchestrate via `engineHealth()` + REST routes. Cross-DB reads go through `packages/engine/src/lookup.ts` (returns `null` on miss — caller renders 400).

### YKP HR V1 Google Sheets patterns

- 17 tabs, first row = headers, data row 2+. `TAB_HEADERS` in `src/db/sheets.ts` is the single source — adding a column means updating that constant + the typed row interface.
- FK violations MUST throw `MissingRefError` at write time (`repo.ts`). The HTTP layer maps it to 400, not 500.
- Hermez read-only summary endpoint: `GET /api/hr/summary?date=YYYY-MM-DD` is public (middleware-allowlisted) and produces aggregate KPIs only — never per-employee PII.
- Every mutation calls `logAudit()` last (post-commit fire-and-forget is acceptable; pre-commit blocking is preferred for payroll/critical ops).

---

## Where to look first

- Status across tracks: `PROGRESS.md`
- Parked ykp-erp known residuals + handoff: `ykp-erp/YKP_ERP_V1_FINAL.md`
- HR V1 pilot runbook: `ykp-hr-v1/PILOT-CHECKLIST.md`
- HR V1 GCP setup: `ykp-hr-v1/docs/GOOGLE-SHEETS-SETUP.md`
- Orchestrator prod runbook + secret rotation: `orchestrator/README.md`
- Auto-memory (project topology, deploy state, known gotchas): `~/.claude/projects/D--Users-stefa-Project-YKP-HERMEZ-AI-COMMAND-CENTER/memory/MEMORY.md`

Global guidance (working style, 5-phase pipeline, anti-patterns): see `~/.claude/CLAUDE.md`.
