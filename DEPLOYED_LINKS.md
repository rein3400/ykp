# YKP Hermez — Deployed Production Links

> Last verified: **2026-09-23** (Coolify self-hosted VPS deploy)
> Source of truth for live URLs. Update this file every deploy.  
> Production code source: branch `origin/stagging` @ `5ad8271` (deep-test fixes 2026-07-22: Hub SSO token baked, Hermez SUPER_ADMIN SSO + ops-summary route, Finance form banner). Prior `1243c84` = security cutover 2026-07-21.

---

## Coolify (self-hosted VPS — active)

Dashboard: `http://187.127.124.37:8000` (project **YKP** / environment `production`).
Deployed from `rein3400/ykp` branch `main` @ `ca6e629`. Apps are published on host ports
(`ports_mappings`), not via Traefik domains. Hub reaches modules server-side over the
shared docker network (`YKP_*_INTERNAL_URL`), browsers use the public IP:port URLs.

| # | App | URL | Notes |
|---|---|---|---|
| 1 | **Hub** (launcher) | http://187.127.124.37:3000 | login via HR user store; health probe 6/6 |
| 2 | **HR V1** (Sheets) | http://187.127.124.37:3002 | LIVE Sheets (20 tabs, users 22, employees 23) |
| 3 | **Finance V1** (Sheets) | http://187.127.124.37:3003 | LIVE Sheets; Moka OAuth OK, outlet map pending |
| 4 | **Warehouse V1** | http://187.127.124.37:3005 | LIVE Sheets |
| 5 | **Investor V1** | http://187.127.124.37:3006 | LIVE Sheets |
| 6 | **Ops V1** | http://187.127.124.37:3007 | LIVE Sheets; AI key still empty |
| 7 | **Owner V1** (aggregator) | http://187.127.124.37:3010 | reads live modules |
| — | ERP hr / finance / hermez | internal only | no public port (V1 wins 3002/3003) |
| — | Postgres / Redis | internal only | `ykp-postgres`, `ykp-redis` (healthy) |

**Scheduled tasks (Coolify, in-container, `CRON_SECRET` / `MOKA_SYNC_SECRET`)**

| App | Task | Cron (UTC) | Purpose | Last test-fire |
|---|---|---|---|---|
| hr-v1 | daily-brief | `0 15 * * *` (22:00 WIB) | Telegram HR brief | SENT (sent:1) |
| hr-v1 | contract-reminders | `0 1 * * *` | contract expiry reminders | registered |
| finance-v1 | daily-brief | `0 15 * * *` | Telegram finance brief | registered |
| finance-v1 | moka-pos-sync | `0 16 * * *` | Moka POS → Sheets | runs; outlet map pending |
| warehouse-v1 | daily-brief | `0 15 * * *` | Telegram warehouse brief | registered |
| warehouse-v1 | random-audit | `0 1 * * 1` | weekly random stock audit | CREATED (W39) |
| warehouse-v1 | verify-audit-chain | `30 16 * * *` | nightly hash-chain check | ok (112 legacy skipped) |
| investor-v1 | daily-brief | `0 15 * * *` | Telegram investor brief | SENT (sent:1) |

**Still needs owner input**

1. **Moka outlet map** — Moka reports three outlets that do **not** exist in `master_outlet`
   (finance sheet has only OL-001 Funkydak Cipete, OL-002 Funkydak Kemang, OL-003 Sekarpizza
   Demangan, OL-004 Sekarpizza Senopati, OL-005 Sekarpizza Kemang):

   | Moka key | Moka outlet id | master_outlet match |
   |---|---|---|
   | `SEKARPIZZA_TIRTODIPURAN` | 772618 | none (Demangan ≠ Tirtodipuran) |
   | `FUNKYDAK_COLOMBO` | 696752 | none |
   | `SUBURBUNS_COLOMBO` | 843676 | none (brand BR-003 exists, no outlet) |

   Fix: add the three outlet rows (or point each to an existing OL id if that is the real
   business intent), then seed `app_settings.moka_outlet_map` = `{"772618":"OL-xxx",…}`
   (or set env `MOKA_OUTLET_MAP` on finance and let the next sync seed it). Until then
   `moka-pos-sync` returns `outlet … belum dipetakan` and writes nothing.
2. `OPENAI_API_KEY` for ops — the only real key in the repo is an **Ollama Cloud** LLM key
   (`ykp-hermez/.env`), but `ykp-ops-v1/src/lib/ai.ts` calls Ollama without an auth header
   (local-only) and OpenAI with `OPENAI_API_KEY`. AI stays off until a real OpenAI key is
   supplied, or that code path learns to send the Ollama key (behaviour change → new change).
3. Password rotation: `owner` in the shared Sheets user store was rotated on 2026-09-23
   (the new value is **not** committed here — ask the owner). Coolify dashboard password
   still needs rotating from `/profile`.
4. Telegram bot `@justatestermaybot` must stay in the target group (chat id comes from
   the warehouse env; the hr/finance env chat id was stale).

---

## Legacy (Railway / Vercel)

| # | App | Platform | Production URL | Auth notes |
|---|---|---|---|---|
| 1 | **Hub** (launcher) | Railway | https://ykp-hub-production.up.railway.app | Hub session; SSO ke finance/hr/hermez |
| 2 | **Finance** | Railway | https://ykp-erp-finance-production.up.railway.app | Role SSO via Hub / demo login |
| 3 | **HR (Postgres)** | Railway | https://ykp-erp-hr-production.up.railway.app | Role SSO via Hub |
| 4 | **Hermez AI** | Railway | https://ykp-erp-hermez-production.up.railway.app | SSO mints SUPER_ADMIN |
| 5 | **HR Pilot (Sheets)** | Railway | https://ykp-hr-v1-standalone-production.up.railway.app | username/password (Sheets users) |
| 6 | **HR Pilot (Sheets)** | Vercel | https://ykp-hr-v1.vercel.app | same app, alternate host |
| 7 | **Warehouse** | Vercel | https://ykp-warehouse-v1.vercel.app | username/password (mock or Sheets) |
| 8 | **Investor** | Vercel | https://ykp-investor-v1.vercel.app | username/password (mock or Sheets) |
| 9 | **Operational (NEW)** | Vercel | https://ykp-ops-v1.vercel.app | `owner` / `owner123` (mock mode) |

---

## Public / Hermez-facing endpoints

| Consumer | Method | URL | Notes |
|---|---|---|---|
| Hermez ← HR V1 | `GET` | http://187.127.124.37:3002/api/hr/summary?date=YYYY-MM-DD | Public allowlist (aggregate only) |
| Hermez ← HR V1 (count) | `GET` | http://187.127.124.37:3002/api/hr/summary/count | Used by Hub health |
| Hermez ← Warehouse | `GET` | https://ykp-warehouse-v1.vercel.app/api/warehouse/summary?date=YYYY-MM-DD | Set `WAREHOUSE_SUMMARY_URL` / `NEXT_PUBLIC_WAREHOUSE_URL` on Hermez |
| Hermez ← Operational | `GET` | https://ykp-ops-v1.vercel.app/api/ops/summary?date=YYYY-MM-DD | Set `OPS_SUMMARY_URL` on Hermez Railway |
| Hermez proxy warehouse | `GET` | https://ykp-erp-hermez-production.up.railway.app/api/hermez/warehouse-summary | Read-only proxy |
| Hermez proxy ops | `GET` | https://ykp-erp-hermez-production.up.railway.app/api/hermez/ops-summary | Read-only proxy |
| Hermez run (cron) | `POST` | https://ykp-erp-hermez-production.up.railway.app/api/hermez/run | Header `x-cron-secret` |
| Investor summary | `GET` | https://ykp-investor-v1.vercel.app/api/investor/summary | Auth required (except if allowlisted later) |
| Investor regenerate | `POST` | https://ykp-investor-v1.vercel.app/api/investor/summary/regenerate | Owner only |

---

## Platform map

### Railway project `ykp-erp-monorepo`
- Project ID: `701f7b7d-5fd7-4625-b0fb-435a2d8b6ef7`
- Environment: `production`
- Services:
  - `ykp-erp-finance` → Dockerfile `Dockerfile` (context `ykp-erp/`)
  - `ykp-erp-hermez` → Dockerfile `./Dockerfile.hermez.new`
  - `ykp-erp-hr` → Dockerfile `./Dockerfile.hr`
  - `ykp-hub` → Dockerfile `Dockerfile` (context `ykp-hub/`)

Redeploy (services **not** git-connected — must upload source):

```bash
cd ykp-erp
railway up --service ykp-erp-finance --environment production -d -y
railway up --service ykp-erp-hermez  --environment production -d -y
railway up --service ykp-erp-hr      --environment production -d -y

cd ../ykp-hub
railway up --service ykp-hub --environment production -d -y
```

### Railway project `ykp-hr-v1-standalone`
- Project ID: `bef53dbe-a10c-4f5a-b5e1-72c12fb258d6`
- Service: `ykp-hr-v1-standalone`

```bash
cd ykp-hr-v1
railway up --service ykp-hr-v1-standalone --environment production -d -y
```

### Vercel (team `stefanusrein33-6364s-projects`)

| Project | Production alias |
|---|---|
| `ykp-warehouse-v1` | https://ykp-warehouse-v1.vercel.app |
| `ykp-investor-v1` | https://ykp-investor-v1.vercel.app |
| `ykp-ops-v1` | https://ykp-ops-v1.vercel.app |
| `ykp-hr-v1` | https://ykp-hr-v1.vercel.app |

```bash
cd ykp-warehouse-v1 && vercel --prod --yes
cd ykp-investor-v1  && vercel --prod --yes
cd ykp-ops-v1       && vercel --prod --yes   # ensure .vercel points at ykp-ops-v1 project
cd ykp-hr-v1        && vercel --prod --yes
```

---

## Local ports (dev)

| App | Path | Port |
|---|---|---|
| Orchestrator (paused) | `orchestrator/` | 3001 |
| HR-v1 / ERP HR | `ykp-hr-v1` / `ykp-erp/apps/hr` | **3002** (collision — run one) |
| Finance | `ykp-erp/apps/finance` | 3003 |
| Hermez | `ykp-erp/apps/hermez` | 3004 |
| Warehouse | `ykp-warehouse-v1` | 3005 |
| Investor | `ykp-investor-v1` | 3006 |
| Operational | `ykp-ops-v1` | 3007 |
| Hub | `ykp-hub` | (Next default / Railway) |

---

## Default test credentials (change before real pilot)

| App | User | Password | Notes |
|---|---|---|---|
| Ops V1 (mock) | `owner` | `owner123` | Mock store; rotate before pilot |
| HR-v1 | `owner` | `owner123` (seed) | Rotate before pilot |
| Warehouse / Investor | seed owner | seed default | Check each app seed |

Finance / HR Postgres / Hermez: Hub SSO role-picker (`OWNER` / `SUPER_ADMIN` for Hermez).

---

## Env wiring checklist (cross-app)

Set on **Hermez Railway** when ready:

```env
WAREHOUSE_SUMMARY_URL=https://ykp-warehouse-v1.vercel.app/api/warehouse/summary
OPS_SUMMARY_URL=https://ykp-ops-v1.vercel.app/api/ops/summary
# optional:
# NEXT_PUBLIC_WAREHOUSE_URL=https://ykp-warehouse-v1.vercel.app
# NEXT_PUBLIC_OPS_URL=https://ykp-ops-v1.vercel.app
```

Set on **Hub Railway** (optional overrides; code has Vercel defaults):

```env
NEXT_PUBLIC_WAREHOUSE_URL=https://ykp-warehouse-v1.vercel.app
NEXT_PUBLIC_INVESTOR_URL=https://ykp-investor-v1.vercel.app
NEXT_PUBLIC_OPS_URL=https://ykp-ops-v1.vercel.app
```

Ops Vercel (currently mock):

```env
SESSION_SECRET=<64 hex, >=32 chars>
USE_MOCK_DB=true
# when Sheets ready:
# GOOGLE_SERVICE_ACCOUNT_EMAIL=
# GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
# YKP_OPS_SPREADSHEET_ID=
```

---

## Health probe (2026-07-21 cutover from `stagging`)

| URL | HTTP | Notes |
|---|---|---|
| hub Railway `/` | 200 | login `owner/owner123` → dashboard 6/6 online |
| finance Railway SSO | 302 | `/api/auth/login?role=OWNER&token=ERP_SSO_SECRET` → cookie + dashboard |
| hermez Railway SSO | 302 | SUPER_ADMIN mint via SSO |
| hr Railway (Postgres) SSO | 302 | OWNER mint via SSO |
| hr-v1-standalone Railway login | 200 | bcrypt verify; hub proxy target |
| warehouse Vercel `/login` | 200 | Sheets real data |
| investor Vercel `/login` | 200 | Sheets real data |
| hr-v1 Vercel `/login` | 200 | Sheets real data |
| ops Vercel `/login` | 200 | mock |

### Env set during cutover (production)
- `ERP_SSO_SECRET` on ykp-erp-finance / ykp-erp-hr / ykp-erp-hermez (shared secret >=16 chars)
- `NEXT_PUBLIC_ERP_SSO_SECRET` on ykp-hub (same value)
- Migration 0002 applied manually: `finance.fin_daily_summary.oldest_unpaid_days` + `hr.hr_attendance_date_outlet_idx`

### Telegram bot (NOT 24/7 yet)
Hermez dialog bot (`bot-worker.mjs`) is long-poll only; prod image `Dockerfile.hermez.new` is web-only. Plan: dedicated VPS for bot after soak (see plan Phase B).

---

## Not deployed (by design / paused)

| App | Reason |
|---|---|
| `orchestrator/` (ICT) | Deprioritized / infra-only paused |
| Marketing module | No app yet (Phase 3) |

---

## Related docs

- Progress log: `PROGRESS.md`
- Railway Dockerfile gotchas: memory `ykp-erp-railway-dockerfile-fix`
- HR pilot: `ykp-hr-v1/PILOT-CHECKLIST.md`
