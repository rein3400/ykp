# Deployed Links Retest Report

> Date: **2026-07-18**
> Tool: Kimi WebBridge (`http://127.0.0.1:10086`)
> Session: `retest-20260718`
> Scope: verify production after Ops login + HR Absensi + Hermez brief fixes

---

## Scorecard

| # | App | URL | Result | After-action notes |
|---|---|---|---|---|
| 1 | Hub | https://ykp-hub-production.up.railway.app | **PASS** | Logged in as owner; 7/7 Online; module cards Finance/HR/Hermez/HR Pilot/Warehouse/Investor/Ops present |
| 2 | Finance | https://ykp-erp-finance-production.up.railway.app | **PASS** | SSO OK → "Finance Command Center"; sidebar Ringkasan/POS/Supplier/Kas/Expense/Laporan/Analitik/Settings |
| 3 | HR Postgres | https://ykp-erp-hr-production.up.railway.app | **PASS** | `/attendance` OK; **Import CSV → `/employees` (no 404)**; Refresh → `/attendance`; Employees table EMP-00001+ loaded |
| 4 | Hermez AI | https://ykp-erp-hermez-production.up.railway.app | **PASS** | Daily Brief body visible (`Brief YKP Hermez — 18/07/2026`); alert link `/alerts?date=2026-07-18` (not undefined) |
| 5 | HR Pilot Railway | https://ykp-hr-v1-standalone-production.up.railway.app | **PASS** | Login owner/owner123 via WebBridge fill → `/hr` "HR Overview" (8 karyawan aktif). FormData fallback + redeploy `e4624bb` |
| 6 | Warehouse | https://ykp-warehouse-v1.vercel.app | **PASS** | Login owner/owner123 → `/warehouse` Overview: 25 items, sidebar Master/Transaksi/Purchase/Alerts |
| 7 | Investor | https://ykp-investor-v1.vercel.app | **PASS** | Login OK → Dashboard: 12 investors, capital Rp 6.247.000.000, net Rp 4.499.000.000 |
| 8 | Operational | https://ykp-ops-v1.vercel.app | **PASS** | Login owner/owner123 → `/ops` "Ringkasan Operational" + full sidebar (was login-loop before fix) |

---

## Fixes re-verified live

### 1. Operational login loop — FIXED
- Action: submit owner/owner123 on `/login`
- After: redirect to `/ops`, body contains "Ringkasan Operational", sidebar modules visible
- Previously: cookie set but middleware 401 → stuck on login

### 2. HR Absensi 404 links — FIXED
- On `/attendance`:
  - Import CSV href = `/employees` (was `/hr/employees` → 404)
  - Refresh href = `/attendance` (was `/hr/attendance` → 404)
- Click Import CSV → landed on Employees page with table data

### 3. Hermez Daily Brief empty body — FIXED
- Home shows:
  - `Brief 2026-07-18`
  - body text: `Brief YKP Hermez — 18/07/2026... Level: GREEN`
  - link: `Lihat alert log untuk 2026-07-18` → `/alerts?date=2026-07-18`
- Previously: header only, empty body, `date=undefined`

---

## Residual issues (not in this fix batch)

| Priority | App | Issue |
|---|---|---|
| LOW | Hermez | Brief content zeros for today (no HR/Finance summary rows for 2026-07-18) — data, not UI |

---

## Commits covered by this retest

- `6c9e4a1` — Ops middleware cookie-shape check + HR attendance route fix + other production tune-ups
- `a0cd1be` — Hermez brief unwrap `data.brief`, alerts filter key `alert_type`, limit 500
- `e4624bb` — HR Pilot login FormData fallback for browser automation + redeploy
- `36ffe64` — Investor revenue/profit from live Finance ERP HTTP (`FINANCE_URL`)
- `8f258f1` / `6b27253` — Finance Settings plain-button tabs + DataTable global filter
- `0c9cf6b` / `d2abfef` / `16b8495` — Warehouse mutation feedback, float qty format, IN_PROGRESS sticky, supabase dep
- `4b19394` / `368a4fd` — HR Pilot master_shift seed/repair + shiftLabel (no BR-xxx)

### 4. Investor Revenue/Profit Rp 0 — FIXED
- Root cause: dashboard read Sheets `YKP_FINANCE_SPREADSHEET_ID` (empty); Finance production is Postgres
- Fix: `lib/finance-summary.ts` → demo SSO to Finance + aggregate `/api/fin/summary`
- After: Revenue **Rp 2.225.079.295**, Profit **Rp 1.043.932.442**, source `http (480 rows)`

### 5. Finance Settings tabs no-op — FIXED
- Root cause: Radix TabsTrigger stuck under synthetic click
- Fix: plain button tablist + conditional panels
- After: Outlet → Master Outlet rows; Supplier → Master Supplier rows

### 6. Warehouse silent ACK/Start + float — FIXED
- Root cause: clients ignored API errors; GET actions auto-overdued IN_PROGRESS; float noise in sheet cells
- Fix: error + reload on mutations; auto-overdue only OPEN; formatQty hardens display
- After: ACK → ACKNOWLEDGED; Start → IN_PROGRESS sticky; Kopi Available shows `—` not `4.699.999…`

### 7. HR Pilot shift labels BR-xxx — FIXED
- Root cause: master_shift names empty/misaligned; bootstrap never seeded shifts
- Fix: seed SH-001..004 + repair names; `shiftLabel()` for form/table
- After: dropdown shows **Pagi / Siang / Split / Malam** (no BR-xxx)

---

*Retest completed 2026-07-18 via Kimi WebBridge.*
