# YKP Hermez — Deployed Production Links

> Last verified: **2026-07-18**  
> Source of truth for live URLs. Update this file every deploy.

---

## Primary (owner / day-to-day)

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
| 9 | **Operational (NEW)** | Vercel | https://ykp-ops-v1.vercel.app | Set `MOCK_PASSWORD` env var (mock mode) |
| 10 | **Finance V1 (Sheets)** | Vercel | TBD — deploy via `ykp-finance-v1/vercel.json` | username/password (Sheets users) |

---

## Public / Hermez-facing endpoints

| Consumer | Method | URL | Notes |
|---|---|---|---|
| Hermez ← HR Pilot | `GET` | https://ykp-hr-v1-standalone-production.up.railway.app/api/hr/summary?date=YYYY-MM-DD | Public allowlist (aggregate only) |
| Hermez ← HR Pilot (count) | `GET` | https://ykp-hr-v1-standalone-production.up.railway.app/api/hr/summary/count | Used by Hub health |
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

## Default test credentials (REMOVED — use seeded credentials)

| App | Notes |
|---|---|
| Ops V1 (mock) | Set `MOCK_PASSWORD` env var. Run `npm run sheets:seed-user` for real Sheets. |
| HR-v1 | Run `npm run sheets:seed-user` with `SEED_PASSWORD` env var. |
| Warehouse / Investor | Run `npm run sheets:seed-user` with `SEED_PASSWORD` env var. |

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

## Health probe (2026-07-18)

| URL | HTTP |
|---|---|
| finance Railway | 200 |
| hermez Railway | 200 |
| hr Railway | 307 |
| hub Railway | 200 |
| hr-v1 Railway | 307 |
| warehouse Vercel | 307 |
| investor Vercel | 307 |
| hr-v1 Vercel | 307 |
| ops Vercel `/login` | 200 |
| ops Vercel `/api/ops/summary` | 200 |

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
