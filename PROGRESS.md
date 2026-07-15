# YKP HERMEZ AI COMMAND CENTER — Progress

> Single source of truth untuk semua track. Update tiap ada perubahan.
> Last update: 2026-07-15

---

## ✅ Completed

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

## 🟡 In Progress

### Phase 4 — Approval UI
- 11 missing approval buttons (leaves/adjustments/payroll approve/mark-paid)

---

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

- ykp-erp-finance-production.up.railway.app (Postgres-backed, 200 OK)
- ykp-erp-hermez-production.up.railway.app (Postgres-backed, 200 OK)
- ykp-erp-hr-production.up.railway.app (Postgres-backed, 200 OK)
- ykp-hr-v1-standalone-production.up.railway.app (Google Sheets pilot, 200 OK)

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