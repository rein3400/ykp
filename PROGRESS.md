# YKP HERMEZ AI COMMAND CENTER — Progress

> Single source of truth untuk semua track. Update tiap ada perubahan.
> Last update: 2026-07-18

---

## ✅ Completed

### AI integration in ykp-ops-v1 (2026-07-18)

Implemented all AI features required by `YKP_ERP_Operational_Developer_Brief_V1.txt`:
- **AI foundation**: `src/lib/ai.ts` OpenAI/Ollama wrapper, env vars, health check.
- **Incident/Complaint AI**: triage, sentiment, response draft, auto-triage on complaint creation, `PATCH /api/ops/incidents/[id]`, `POST /api/ops/incidents/[id]`, updated UI.
- **Analytics AI insight**: `POST /api/ops/summary/ai-insight`, AI insight panel in `/ops/analytics`.
- **Visual QC AI vision**: base64 photo upload, `gpt-4o-mini` second opinion, never overrides human decision, UI shows AI result/confidence/disagreement.
- **AI Assistant**: new `/ops/ai-assistant` page + `/api/ops/ops/ai-assistant` endpoint for general ops Q&A.
- Schema updates: `ops_incident` (`ai_triage`, `ai_sentiment`, `ai_response_draft`, `ai_generated_at`), `ops_daily_summary` (`ai_insight`, `ai_insight_generated_at`).
- Verified: `tsc --noEmit` clean, `npm test` 4/4, `npx next build` green.



| Track | Status code | Notes |
|---|---|---|
| **Operational** | **NEW** `ykp-ops-v1` port 3007 | Sheets+mock, 9 modules + AI (incident triage/draft, analytics insight, vision QC second opinion, AI assistant), `ops_daily_summary`, public GET `/api/ops/summary`, vitest 4/4, tsc clean |
| **HR** | residual close | Lateness approve UI+API, GPS radius on clock-in, employees edit/deactivate already wired |
| **Investor** | residual close | `investor-summary.ts` writer + alerts, POST `/api/investor/summary/regenerate`, auto on capital/dividend |
| **Hub** | residual close | apps list + health probe: warehouse, investor, ops |
| **Finance** | residual close | Expense cross-link fields (source_module/linked_*) schema+API+form |
| **Warehouse** | already ~100% code | Purchase-request approve UI + telegram dispatch already present; tsc clean |
| **Hermez** | multi-source | `ykp-erp/apps/hermez` is primary V1 (writes brief/alert log to Postgres); `ykp-hermez/` is read-only Telegram interface |

Verification (local):
- `ykp-ops-v1` tests 4/4, tsc clean
- `ykp-hr-v1` / `ykp-investor-v1` / `ykp-hub` / `ykp-warehouse-v1` tsc clean
- `ykp-erp` tsc clean after engine+schema rebuild

Masih owner-side (bukan code): GCP Sheets bootstrap, data pack asli, pilot 7 hari.

### Deploy 2026-07-18

| App | Platform | URL | Status |
|---|---|---|---|
| Finance | Railway | https://ykp-erp-finance-production.up.railway.app | SUCCESS / 200 |
| Hermez | Railway | https://ykp-erp-hermez-production.up.railway.app | SUCCESS / 200 |
| HR (erp) | Railway | https://ykp-erp-hr-production.up.railway.app | SUCCESS / 307 |
| Hub | Railway | https://ykp-hub-production.up.railway.app | SUCCESS / 200 |
| HR-v1 | Railway | https://ykp-hr-v1-standalone-production.up.railway.app | SUCCESS / 307 |
| HR-v1 | Vercel | https://ykp-hr-v1.vercel.app | READY / 307 |
| Warehouse | Vercel | https://ykp-warehouse-v1.vercel.app | READY / 307 |
| Investor | Vercel | https://ykp-investor-v1.vercel.app | READY / 307 |
| **Ops (NEW)** | Vercel | https://ykp-ops-v1.vercel.app | READY / 307 login; `/api/ops/summary` 200 |

Note: ops first deploy accidentally hit `ykp-hr-v1` Vercel project; restored HR-v1 then created dedicated `ykp-ops-v1` project.

### Warehouse Inventory Control V1 (2026-07-15)
- ✅ Upgrade `ykp-warehouse-v1` ke full brief `YKP_ERP_Warehouse_Inventory_Developer_Brief_V1.txt`
- ✅ 6 phase: Master Data → Ledger → Receiving/Issue/Waste/Adjustment → Transfer/Opname → Purchase Engine/Expiry → Alerts/Actions/Summary/Telegram
- ✅ Schema: 37 Sheets tabs (dari 14); master_item 32 kolom; location/unit_conversion/category/threshold
- ✅ Engine: `stock-ledger.ts` (immutable 12 movement types), `inventory-engine.ts` (reorder/days_of_cover/suggested/priority), `rules-engine.ts` (14 alert types), `approval.ts`, `telegram.ts`
- ✅ RBAC 11 roles (dari 5); audit expanded (module/record_type/approval_user_id/environment)
- ✅ 18 API routes + 18 pages (overview, master×6, transaksi×7, purchase×2, alert/action/summary/dashboard)
- ✅ Auto ledger post: receiving APPROVED → RECEIPT; issue → ISSUE; transfer DISPATCHED/RECEIVED → TRANSFER_OUT/IN; waste/adjustment → WASTE/COUNT_ADJUSTMENT
- ✅ HIGH/CRITICAL alert → auto action tracker; "unexplained stock variance" terminology
- ✅ Tests: vitest 40/40 (inventory-engine 16 + rules-engine 24); `tsc --noEmit` clean
- ⏸️ Belum: GCP service account + spreadsheet ID → `npm run sheets:bootstrap`; deploy Railway; pilot 10–20 item 1 outlet

### Bug Fixes
- ✅ CSP hydration blocker (3 ykp-erp apps) — added `'unsafe-inline'` to script-src
- ✅ Tambah Expense no onClick (finance) — created ExpenseFormDialog
- ✅ Sheets API range fix (ykp-hr-v1) — `quoteTab()` helper
- ✅ Edge runtime crypto (hr-v1) — Web Crypto API in middleware
- ✅ Owner RBAC wildcard (hr-v1) — `if (role === 'owner') return true`
- ✅ Role case normalization (hr-v1) — `.toLowerCase()` in session
- ✅ DB SSL config (Supabase pooler self-signed) — conditional `rejectUnauthorized: false`

### Deployment
- ✅ All 4 apps deployed to Railway
- ✅ ykp-hr-v1 fully live (pilot ready)
- ✅ ykp-erp-hr/finance/hermez all 200 OK

### Database
- ✅ Supabase DB schema migrated (4 schemas: master, hr, finance, hermez)
- ✅ Mock data seeded: 5 brands, 15 outlets, 50 employees, 20 suppliers, 1,355 attendance, 450 POS, 450 expenses, 237 supplier_costs, 450 petty_cash, 500 daily summaries, 50 payroll, 90 alerts, 30 daily briefs, 350 audit log
- **Total: ~5,000 records**

### Sheets
- ✅ Bootstrap 17 tabs + seed (5 brands, 9 roles, 7 leave types, 10 outlets, 9 shifts, 8 employees, 1 user)

---

### Architecture Decision — Dual Hermez strategy (2026-07-20)

There are two Hermez implementations in the repo:

1. **`ykp-erp/apps/hermez`** (primary for V1 pilot) — Next.js app, cron-based daily brief generator that reads `hr_daily_summary` + `fin_daily_summary` and writes `hermez_daily_brief` / `hermez_alert_log` to Postgres. This matches blueprint §10.
2. **`ykp-hermez/`** (Telegram interface) — Standalone Node service with LLM tool-use and Telegram long-polling. It reads the public summary APIs of HR/Finance/Ops/Warehouse/Investor and responds to owner messages. It does **not** write back to any domain DB (enforced by `tools.ts`).

Going forward:
- V1 pilot uses `ykp-erp/apps/hermez` as the source of truth for `hermez_daily_brief` and `hermez_alert_log`.
- `ykp-hermez/` remains a read-only conversational interface. It can be pointed at the public summary endpoints and, in the future, at `/api/hermez/brief` to fetch the already-generated brief instead of recomposing it.
- Do not add write-back paths from `ykp-hermez/` into HR/Finance/Operational tables; that boundary is enforced by the public-API-only tool set.

## 🟡 In Progress

### Phase 4 — Approval UI
- 11 missing approval buttons (leaves/adjustments/payroll approve/mark-paid)

---

### Architecture Decision — 3-DB split compliance (2026-07-20)

Blueprint §4.3 specifies three isolated databases: `YKP_MASTER_DATABASE`, `YKP_HR_DATABASE`, and `YKP_FINANCE_DATABASE`. In the V1 Google Sheets implementation (`ykp-hr-v1` / `ykp-finance-v1`), each app owns its own spreadsheet and embeds `master_brand` and `master_outlet` tabs inside it.

- **Status for V1 pilot**: accepted deviation. A single spreadsheet per app is simpler to bootstrap, share with the owner, and manage permissions for 5–10 staff / 1 outlet.
- **Risk**: master data (brands, outlets) can drift between HR and Finance spreadsheets.
- **Mitigation**: app-layer FK validation (`assertBrand` / `assertOutlet`) ensures any referenced master row exists in the local spreadsheet. Summary APIs only return aggregates, never raw master rows.
- **V2 path**: introduce a shared `MASTER_SPREADSHEET_ID` (or migrate to Postgres `ykp_master`) and have domain apps read brands/outlets from it. Until then, keep HR and Finance master tabs in sync during onboarding.

## ⏸️ Blocked

### Login UI for ykp-erp apps
- ykp-erp/{finance,hermez,hr} have no login form
- Test via Playwright with session cookie works
- User-facing testing requires login UI

### Phase 5-6
- Sidebar logout button (hr-v1)
- HR Overview filters
- Employee edit/deactivate row actions

---

## 📋 Open Tasks

| # | Task | Priority | Status |
|---|---|---|---|
| 1 | Phase 4: Wire approval UI | High | Pending |
| 2 | Phase 5: Logout + Emp actions | Med | Pending |
| 3 | Phase 6: HR Overview filters | Med | Pending |
| 4 | Login UI for ykp-erp | Med | Pending (design choice) |
| 5 | PDF payslip | Low | Deferred (Phase 7) |
| 6 | GPS/Telegram/QR | Low | Deferred (Phase 7) |

---

## 🌐 Live URLs (all verified)

> Full catalog + redeploy commands: **[`DEPLOYED_LINKS.md`](./DEPLOYED_LINKS.md)** (updated 2026-07-18).

| App | URL |
|---|---|
| Hub | https://ykp-hub-production.up.railway.app |
| Finance | https://ykp-erp-finance-production.up.railway.app |
| HR (Postgres) | https://ykp-erp-hr-production.up.railway.app |
| Hermez AI | https://ykp-erp-hermez-production.up.railway.app |
| HR Pilot Railway | https://ykp-hr-v1-standalone-production.up.railway.app |
| HR Pilot Vercel | https://ykp-hr-v1.vercel.app |
| Warehouse | https://ykp-warehouse-v1.vercel.app |
| Investor | https://ykp-investor-v1.vercel.app |
| Operational | https://ykp-ops-v1.vercel.app |

---

## 📊 DB Counts at 2026-07-10

| Entity | Count |
|---|---|
| Brands | 5 |
| Outlets | 15 |
| Employees | 50 |
| Attendance records | 1,355 |
| POS transactions | 450 |
| Expenses | 450 |
| Petty cash | 450 |
| Alerts | 90 |
| Audit log | 350 |
| **Total** | **~5,000** |

---

## 🐛 Known Issues

1. **hr-v1 /hr/payroll generate dialog** — `Run` button text mismatch (test bug, not app)
2. **hr-v1 /hr/leaves** — employee dropdown empty (no employee loader wired)
3. **hr-v1 /hr/adjustments** — same dropdown issue
4. **ykp-erp** — rate limit 429 under parallel test load (raised to 60/30)
5. **Build cache** — GitHub auto-deploy not always picking up new commits immediately

---

## 📝 Notes

- Trial plan: 2 projects per workspace (Railway)
- Supabase free tier has 500MB DB + 1GB egress
- Build cache = manual `railway up` still needed sometimes
- Sandbox pooler uses self-signed cert (handled via `rejectUnauthorized: false` for dev)

---

## 🎯 Next Session

1. **Phase 4**: Wire 4 missing approval UI buttons (leaves, adjustments, payroll approve, payroll mark-paid) — pure code work
2. **Phase 5**: Sidebar logout button + employee row actions (edit/deactivate)
3. **Phase 6**: HR Overview filters (brand/outlet/period)
4. **Login UI**: Decide if we need a login form for ykp-erp apps (or rely on cookie injection for testing)
5. **Phase 7** (deferred): PDF payslip, GPS, Telegram, QR, photo upload

---

## 📜 History

### 2026-07-15 (lanjutan — penuhi detail 3 brief)
- Warehouse dashboard Excel 7 KPI 1:1 + temuan/rencana aksi + Aturan Emas; opening-balance API
- Hermez wire warehouse summary/alerts (`/api/hermez/warehouse-summary`, `/warehouse-alerts`, page `/warehouse`)
- Revisi residual: finance cross-link fields (source_module/linked_*) + fin-summary double-count skip
- HR residual: roster swap+conflict, attendance correction+GPS fields, leave doctor_letter, adjustment attachment, employee full detail, User & Role UI (`/hr/users`)
- tsc clean warehouse + hr-v1 + erp schema/engine/hermez; warehouse tests 40/40

### 2026-07-15
- Warehouse Inventory Control V1 full upgrade from brief V1 (18 modul, ~15 tabel, 2271 baris)
- `ykp-warehouse-v1`: 37 tabs, 5 engine libs, 18 API + 18 pages, RBAC 11 roles, 40 unit tests green
- Stock ledger auto-immutable; purchase recommendation engine; FEFO batch expiry; telegram delivery log
- Gap closed: ~25% → ~full V1 code surface (DoD §38 code-complete; pilot/data pack still owner-side)

### 2026-07-14
- ERP revisi 5-wave: 31 item dari `YKP_ERP_List_Revisi_Developer.txt` via 14-agent workflow
- Warehouse+Investor V1 scaffold (Next.js + Sheets, ports 3005/3006, mock mode)

### 2026-07-10
- Mock data seeder: fixed all enum casing issues (attendance_status, approval_status, payment_status, etc.)
- Added ON CONFLICT (alert_id) DO NOTHING to alerts insert
- Seeded ~5,000 records across 19 tables
- Verified DB connection from Railway apps works (master-data 200, employees 200)

### 2026-07-09
- Fixed hr-v1 502 proxy via Web Crypto middleware
- Fixed owner RBAC wildcard + role case normalization
- Bootstrap Sheets: 17 tabs + 8 employees + 10 outlets

### 2026-07-08
- Migrated to Railway monorepo project `ykp-erp-monorepo`
- 4 Dockerfiles (finance/hermez/hr/hr-v1) with proper multi-stage builds
- Fixed CSP hydration blocker
- Created ExpenseFormDialog

### 2026-07-07
- ykp-erp marked as parked (per CLAUDE.md)
- ykp-hr-v1 pilot scope defined