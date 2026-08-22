# AGENTS.md — YKP HERMEZ AI COMMAND CENTER

> Universal agent entry point. Read this file **completely** before touching
> anything. It is the single source of truth for project topology, deploy
> state, invariants, and gotchas. `CLAUDE.md` (same dir) holds the same
> knowledge plus per-track command detail — treat both as authoritative.

---

## 1. What this repo is

Monorepo for **YKP Hermez AI Command Center** — an Indonesian F&B/retail
group's internal ERP + AI assistant. Three independent tracks plus shared
infra. Storage strategy differs per track (Postgres / Google Sheets / mock).

| Track | Path | Port | Status |
|---|---|---|---|
| A — ICT trading orchestrator | `orchestrator/` | API `3001`, dashboard `/dashboard` | deprioritized; smoke-clean, infra-only paused |
| B-OLD — ykp-erp monorepo | `ykp-erp/` | HR `3002`, Finance `3003`, Hermez `3004` | **parked** 2026-07-07 (14 CRITICAL/HIGH residuals). See `ykp-erp/YKP_ERP_V1_FINAL.md` |
| B-NEW — HR V1 (Google Sheets) | `ykp-hr-v1/` | `3002` local / `3008` VPS | **active + LIVE in production** (Telegram absen bot) |
| B-NEW — other V1 apps | `ykp-warehouse-v1/`, `ykp-investor-v1/`, `ykp-ops-v1/`, `ykp-hub/`, `ykp-owner-v1/`, `ykp-finance-v1/`, `ykp-hermez/` | 3005–3007 | deployed (Vercel/Railway), Sheets or mock |
| Infra | `mt5-bridge-service/`, NSSM Windows services, Cloudflare Tunnel, Caddy | — | deployed for orchestrator |

> **Port collision:** `ykp-erp/apps/hr` and `ykp-hr-v1` both bind `3002`.
> Run one at a time locally.

Source briefs at repo root: `HERMES_AI_SRI_ICT_Developer_Brief.txt` (Track A),
`YKP_ERP_HR_Developer_Brief_V1.txt` / `YKP_ERP_Finance_Developer_Brief_V1.txt`
/ `YKP_ERP_Operational_Developer_Brief_V1.txt` / `YKP_ERP_Warehouse_Inventory_Developer_Brief_V1.txt`
(Track B), `YKP_ERP_Roadmap_Phase1_Migration_Brief.pdf` +
`YKP_Hermez_Developer_Brief_Migration_V1.docx` (foundational).

`.backup_ykp-demo_2026-07-03/` is a stale Clerk-based Next.js starter snapshot
from recon — **do not develop against it**.

---

## 2. Cross-cutting invariants (enforced everywhere — verify before merge)

1. **Hermez is read-only** against HR/Finance tables. `ykp-erp/apps/hermez/src/lib/no-write-back.ts`
   enumerates forbidden tables; write boundary always returns
   `HERMEZ_WRITEBACK_ENABLED === "true"` check. Engine side:
   `packages/engine/src/hermez-brief.ts:9-13` and `lookup.ts` read-only paths.
2. **Currency = integer IDR.** All money columns `integer().default(0)`.
   CSV/Moka parsers strip `Rp`/`.`/`,`. No decimals. Display via
   `formatIdr(n)` → `Rp 1.234.567`.
3. **Timezone = `Asia/Jakarta`.** Single source:
   `ykp-erp/packages/config/src/index.ts:7` `TZ = "Asia/Jakarta"`. Cascaded to
   docker `TZ/PGTZ`, Postgres default, `master_outlet.timezone`, all
   `Intl.DateTimeFormat` calls. Cron: `HERMEZ_RUN_HOUR_UTC=15` (= 22:00 WIB).
4. **Stable prefixed IDs** (`BR-NNN`, `OL-NNN`, `EMP-NNNNN`, `SUP-NNNN`,
   date-encoded dailies `HRR-OL-YYYYMMDD-NNN`, `FIN-YYYYMMDD[-OL]-NNN`,
   `HZBR-YYYYMMDD`, `HZAL-YYYYMMDD-NNN`). Single source:
   `ykp-erp/packages/engine/src/id-gen.ts`. Storage column is `TEXT` PK (not
   bigserial) so app layer owns ID. `bigserial` only for `audit_log.id`.
5. **Auth = 24h HS256 cookie** (`ykp_session`), `NEXTAUTH_SECRET` >=32 chars,
   strict SameSite, httpOnly. ykp-hr-v1 parallels this in `src/lib/session.ts`.
   RBAC matrix in `ykp-erp/packages/auth/src/rbac.ts` (8 roles) and
   `ykp-hr-v1/src/lib/rbac.ts` (9 roles).
6. **No shell**, always `spawn(cmd, args, { shell:false })`. See
   `ykp-erp/scripts/migrate.mjs`.
7. **5xx never leaks stack.** `ykp-erp/apps/{hr,finance,hermez}/src/app/api`
   uses envelope `{data}` / `{error:{code,message}}`. ykp-hr-v1
   `src/lib/http.ts` same shape.
8. **Audit log per domain DB** (`master_audit_log` / `hr_audit_log` /
   `finance_audit_log` / `hermez_audit_log`) — no cross-DB writes; emitter
   `packages/engine/src/audit.ts`. ykp-hr-v1 writes only to `audit_log`
   Sheets tab, idempotent + best-effort.
9. **Migrations are advisory-locked.** `pg_advisory_xact_lock(74213721)` so
   API and worker can both migrate on startup safely.
10. **Hermez DB has no production writeback path.**
    `HERMEZ_WRITEBACK_ENABLED=false` hard-coded in `no-write-back.ts:30`.

---

## 3. Per-track commands

### `orchestrator/` — Node 22 + Fastify 5 + Drizzle + grammy + Qdrant

```bash
npm install
docker compose up -d postgres redis                    # or --profile ollama for local LLM
cp .env.example .env && $EDITOR .env                  # TELEGRAM_*, OPENAI_API_KEY, TRADINGVIEW_WEBHOOK_SECRET, DATABASE_URL
npm run db:migrate                                    # pg_advisory_xact_lock-guarded, idempotent
npm run db:seed
npm run dev        # API on http://localhost:3001
npm run worker     # BullMQ scheduler + Telegram bot (long-poll, or webhook if TELEGRAM_WEBHOOK_MODE=true)
npm test           # vitest
npm run lint       # tsc --noEmit
npm run build      # tsc compile
npm run db:generate# drizzle-kit generate
```

Production (Option A — Windows host): copy `.env.prod.example` → `.env.prod`,
`docker compose up -d --build`. NSSM services: `YKPMT5Bridge` (native Win,
MT5 SDK is Windows-only) + `YKPCloudflared`. See `orchestrator/README.md`.

### `ykp-erp/` — Node 20 + Next.js 14 + npm workspaces + Drizzle + BullMQ

```bash
npm install
docker compose up -d                                  # postgres:17 + redis:7
cp .env.example .env && $EDITOR .env                  # YKP_{MASTER,HR,FINANCE,HERMEZ}_DATABASE_URL, REDIS_URL
npm run db:generate                                   # drizzle-kit generate per schema bundle
npm run db:migrate                                    # scripts/migrate.mjs → 4 DBs under pg_advisory_xact_lock(74213721)
npm run db:seed
npm run dev                                           # concurrently runs hr + finance + hermez
npm test                                              # vitest in apps/{hr,finance,hermez}
npm run lint / typecheck / build / smoke
```

Workspace layout (`packages/`): `schema` (per-DB Drizzle schemas + migrator),
`engine` (pure calculators: payroll, attendance, hr/fin-summary, moka-importer,
approval, hermez-brief + 7 triggers, cron, telegram, audit, id-gen, lookup),
`ui`, `auth`, `config`, `format`. Dependency direction:
`apps → engine/format/ui/auth → config`; `schema` consumed only by `engine`
and `apps/*` server side. `format` is a leaf.

### `ykp-hr-v1/` — Next.js 16 + Google Sheets API (ACTIVE, LIVE)

```bash
npm install
# 1. docs/GOOGLE-SHEETS-SETUP.md: GCP service account, share spreadsheet as Editor
cp .env.example .env && $EDITOR .env                  # GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (\\n literal), YKP_HR_SPREADSHEET_ID, SESSION_SECRET (>=32 chars)
npm run sheets:bootstrap                              # idempotent: create tabs + seed brands/roles/leave_types/lateness_rules
npm run sheets:smoke                                  # write+read roundtrip
npm run sheets:seed-user                              # default owner/owner123 — CHANGE before pilot
npm test                                              # vitest (payroll + summary engine)
npm run dev                                           # http://localhost:3002
npm run build / lint                                  # oxlint
```

DB layer: `src/db/sheets.ts` (googleapis JWT client, `TABS`/`TAB_HEADERS`,
`readTab`/`appendRows`/`updateRow`/`findRow`). FK validation in app layer at
`src/lib/repo.ts` (assertBrand/assertOutlet/assertEmployee/assertShift →
MissingRefError → 400). IDs sequential per prefix via `nextSequentialId`.
9 sections per brief §6 in `src/app/hr/`. Hermez-facing read:
`GET /api/hr/summary?date=` (public allowlist in `middleware.ts`).

### `mt5-bridge-service/` — Python 3.11 + FastAPI (Windows-only SDK)

```bash
python -m venv .venv && .venv\Scripts\activate
pip install -e .                                       # MetaTrader5 5.0.45 SDK, fastapi, uvicorn, pydantic
nssm install YKPMT5Bridge                              # NSSM wrapper in scripts/nssm/
```

Native Windows service. Containerized bridge is impossible — MT5 SDK is
Windows-only. Orchestrator reaches it at
`MT5_BRIDGE_URL=http://host.docker.internal:8765` with `MT5_BRIDGE_TOKEN`
Bearer. Endpoint contract in `orchestrator/src/modules/mt5-http-bridge.ts`.
One process per MT5 account (race + global state otherwise).

---

## 4. Big-picture architecture

### Three tracks, three storage strategies

| Track | Storage | Why |
|---|---|---|
| orchestrator | 1 Postgres `ykp` (Drizzle) + Redis + Qdrant | single-DB, vector sidecar |
| ykp-erp | **4 Postgres DBs** (`ykp_master` / `ykp_hr` / `ykp_finance` / `ykp_hermez`) on one server | cross-DB FK impossible in PG; app-layer validates master refs (`packages/schema/src/db/clients.ts:8-23`) |
| ykp-hr-v1 | Google Sheets (17 tabs, header row 1) | brief V1 allowed; 60 writes/min quota ok for 5-10 staff × 7-day pilot |

### Orchestrator module wiring (read these to extend)

- HTTP entry: `orchestrator/src/index.ts` → migrations → Fastify → listen.
  Worker entry: `orchestrator/src/worker-entry.ts` → migrations → env owner →
  BullMQ workers → Telegram bot (webhook if configured else long-poll).
- Fastify assembly: `orchestrator/src/app.ts:10-108` helmet + CORS + rate-limit
  + static `dashboard/` + lazy `registerRoutes()`.
- Domain flow: `trading-view webhook → trading-engine.ts → scoring →
  session-filter + news-filter → risk-manager → approval → telegram signal →
  on APPROVED → trade-executor → mt5-bridge`. Persistent lifecycle logged in
  `trading_journal`, `trade_executions`, `audit_logs`. Circuit-breaker wraps
  MT5 HTTP calls.
- RAG: `knowledge-ingest.ts` → `embeddings` (OpenAI 1536 / Ollama 768) →
  Qdrant. `knowledge-search.ts` consumed by `sop-bot`. Use `EMBED_PROVIDER`
  env to pick a collection; never mix dims.
- 5 agents live in `modules/agents.ts` — system prompts only; routed via
  `ai-router.ts` `taskType` (no separate processes).

### YKP ERP package dependency rules (enforce with import lint)

```
apps/{hr,finance,hermez}
   ↓ uses
packages/engine ← depends on packages/schema (Drizzle)
                  ↓ depends on
              packages/format (leaf) ─→ packages/config (leaf)
packages/ui / packages/auth / packages/config            ← leaf-ish
```

`packages/engine` is the only domain-logic place; apps orchestrate via
`engineHealth()` + REST routes. Cross-DB reads go through
`packages/engine/src/lookup.ts` (returns `null` on miss — caller renders 400).

### YKP HR V1 Google Sheets patterns

- 17 tabs, first row = headers, data row 2+. `TAB_HEADERS` in
  `src/db/sheets.ts` is the single source — adding a column means updating
  that constant + the typed row interface.
- FK violations MUST throw `MissingRefError` at write time (`repo.ts`). HTTP
  layer maps it to 400, not 500.
- Hermez read-only summary endpoint: `GET /api/hr/summary?date=YYYY-MM-DD` is
  public (middleware-allowlisted) and produces aggregate KPIs only — never
  per-employee PII.
- Every mutation calls `logAudit()` last (post-commit fire-and-forget is
  acceptable; pre-commit blocking preferred for payroll/critical ops).

---

## 5. Telegram attendance bot (PRODUCTION — newest, most important)

> Full runbook: `ykp-hr-v1/docs/TELEGRAM-ATTENDANCE-BOT.md`

The HR V1 absen bot is **LIVE in production** on the VPS. This is the active
workstream — understand it deeply before touching `ykp-hr-v1`.

### Deploy facts

- VPS: `187.52.124.40`, SSH user `dev`.
- App path: `/home/dev/ykp/ykp-hr-v1`, PM2 app `ykp-hr-v1`, port `3008`.
- Webhook: `POST https://oseedigital.tech/api/hr/attendance/telegram`,
  validated via `X-Telegram-Bot-Api-Secret-Token` header against
  `TELEGRAM_WEBHOOK_SECRET`.
- Caddy route: `/api/hr/attendance/telegram` → `localhost:3008` (must stay
  BEFORE the `/api/hr/*` catch-all that points at old HR ERP on 3002).
- Env file: `/home/dev/ykp/ykp-hr-v1/.env` (`USE_MOCK_DB=false`).
- Restart: `pm2 restart ykp-hr-v1 --update-env` (with full nvm PATH).

### Spreadsheet (source of truth)

Link: `https://docs.google.com/spreadsheets/d/1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg/edit`

Spreadsheet ID: `1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg`

All HR V1 data (employees, outlets, attendance, payroll, users) lives here.
The bot reads/writes directly to it — not to code or config files.

### Chat id setup (multi-employee)

Bot matches sender chat id → `master_employee.telegram_id` (column H). One
chat id = one employee. To onboard a new employee:

1. Open the spreadsheet → tab `master_employee`.
2. Fill `telegram_id` with the employee's Telegram chat id (exact number, no
   quotes/spaces).
3. Done — no restart needed.

Get a chat id: employee chats the bot (`/start` or `/help`), or forwards any
message to `@userinfobot`.

**Role is resolved from `users.employee_id` → `users.role`, NOT from
`master_employee`.** An employee who must be geofence-exempt (e.g. HR admin)
needs a matching row in the `users` tab with the right role.

### Geofence (per-outlet)

Geofence is **per-outlet**: each outlet has its own `latitude`, `longitude`,
`attendance_radius_m` in `master_outlet`. Employees are matched to their own
outlet — not one global coordinate.

**Management-role exemption** (`src/lib/attendance-service.ts` →
`GEO_EXEMPT_ROLES`): these roles clock in from anywhere:

- `owner`, `super_admin`, `hr_admin`, `finance_admin`

Everyone else stays radius-locked: `employee`, `supervisor`, `outlet_manager`.

### Location sending (Telegram platform limitation)

- HP (Android/iOS): "Kirim Lokasi" reply-keyboard button works.
- Desktop: the `request_location` button is NOT rendered. Correct method is
  📎 (paperclip) → Location → pick point on map → send.
- Bot has a fallback: text "Kirim Lokasi" gets a helpful instruction reply
  (not "perintah tidak dikenali").

### Bot commands

- `/masuk` — clock in (location required)
- `/pulang` — clock out
- `/help` — help + location instructions

### Clock-in flow

1. Employee sends `/masuk`.
2. Bot asks for location.
3. Employee sends location (HP button / desktop 📎).
4. Bot checks radius vs employee's outlet:
   - inside → `INSIDE_RADIUS`, PRESENT
   - outside + management role → `OUTSIDE_RADIUS`, PRESENT
   - outside + regular role → rejected, "ajukan koreksi manual"

### Critical Sheets gotcha (do not regress)

`appendRows` in `src/db/sheets.ts` MUST use `valueInputOption: 'RAW'`, not
`'USER_ENTERED'`. `USER_ENTERED` + Indonesian locale corrupts lat/lon
(`-6.2741` → `-62.741`) because `.` is treated as thousands separator.

---

## 6. Deploy state (live URLs)

> Full catalog + redeploy commands: `DEPLOYED_LINKS.md` (verified 2026-07-22).

| App | Platform | URL |
|---|---|---|
| Hub (launcher) | Railway | https://ykp-hub-production.up.railway.app |
| Finance | Railway | https://ykp-erp-finance-production.up.railway.app |
| HR (Postgres) | Railway | https://ykp-erp-hr-production.up.railway.app |
| Hermez AI | Railway | https://ykp-erp-hermez-production.up.railway.app |
| HR Pilot (Sheets) | Railway | https://ykp-hr-v1-standalone-production.up.railway.app |
| HR Pilot (Sheets) | Vercel | https://ykp-hr-v1.vercel.app |
| Warehouse | Vercel | https://ykp-warehouse-v1.vercel.app |
| Investor | Vercel | https://ykp-investor-v1.vercel.app |
| Operational | Vercel | https://ykp-ops-v1.vercel.app |

Railway project `ykp-erp-monorepo` ID `701f7b7d-5fd7-4625-b0fb-435a2d8b6ef7`;
HR-v1 standalone project ID `bef53dbe-a10c-4f5a-b5e1-72c12fb258d6`. Vercel team
`stefanusrein33-6364s-projects`.

---

## 7. Where to look first

- Status across tracks: `PROGRESS.md`
- Parked ykp-erp known residuals + handoff: `ykp-erp/YKP_ERP_V1_FINAL.md`
- HR V1 pilot runbook: `ykp-hr-v1/PILOT-CHECKLIST.md`
- HR V1 GCP setup: `ykp-hr-v1/docs/GOOGLE-SHEETS-SETUP.md`
- **HR V1 Telegram bot (production): `ykp-hr-v1/docs/TELEGRAM-ATTENDANCE-BOT.md`**
- Orchestrator prod runbook + secret rotation: `orchestrator/README.md`
- Live URL catalog + redeploy: `DEPLOYED_LINKS.md`

---

## 8. Hard rules (anti-patterns — auto-reject)

- Never answer from memory when source exists — read the file, cite `file:line`.
- Never skip a plan on >1 file changes.
- Never patch without root-cause trace.
- Never claim "done" without verification (build/test/manual check).
- Never hardcode secrets in committed files — reference env vars only.
- Never use `shell:true` — always `spawn(cmd, args, { shell:false })`.
- Never leak stack traces in 5xx — use the `{error:{code,message}}` envelope.
- Never mix embedding dims in Qdrant (OpenAI 1536 vs Ollama 768).
- Never containerize the MT5 bridge (Windows-only SDK).
- Never develop against `.backup_ykp-demo_2026-07-03/`.
