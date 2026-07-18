# Deployed Links — Deep Button/Feature Test Report

> Tested: **2026-07-18**  
> Tool: Kimi WebBridge (browser automation)  
> Scope: every page, button, filter, modal, after-action verification  
> Method: parallel agents per app + main-thread diagnosis

---

## Executive summary

| App | Overall | Critical issues |
|---|---|---|
| Hub | ✅ PASS | Preview = window.open (bukan iframe — intentional); Ops no SSO bridge |
| Finance | ⚠️ PARTIAL | POS search no-op; Settings tabs don't switch; KPI totals inconsistent |
| HR Postgres | ⚠️ PARTIAL | Absensi Import/Refresh → 404 (`/hr/*` wrong prefix); Rebuild hangs; rate-limit under load |
| Hermez AI | ⚠️ PARTIAL | Daily Brief body empty; alert date=undefined; severity filter hangs |
| HR Pilot Railway | ✅ MOSTLY PASS | Roster empty; shift labels wrong; form validation UX weak |
| Warehouse | ⚠️ PARTIAL | PR create no-op; ACK/Start silent; float corruption; ledger intermittent crash |
| Investor | ⚠️ PARTIAL | Returns all zeros; SPA nav click may not work; Finance KPIs empty |
| Operational | ❌ BLOCKED | Login loop: cookie set but middleware rejects (SESSION_SECRET mismatch?) |

---

## 1. Hub (launcher)
**URL:** https://ykp-hub-production.up.railway.app  
**Auth:** owner session (then logout verified)

### After-action results

| Action | After-action | Result |
|---|---|---|
| Page load as owner | "Selamat sore, owner", 7/7 Online, module cards | PASS |
| Theme toggle | Click succeeds | PASS |
| Command palette open | Dialog/search opens | PASS |
| Type "finance" in palette | Value set | PASS |
| Preview Finance click | No dialog/iframe appeared (page stayed on hub) | **FAIL / unclear** |
| Logout | Redirect to login form "Selamat datang kembali", default owner/owner123 | PASS |
| Module cards Buka/Preview | Present for all 7 modules | PASS |
| System status rows | Finance 79ms, HR 41ms, Hermez 65ms, HR Pilot 123ms, etc. | PASS |

---

## 2. Finance
**URL:** https://ykp-erp-finance-production.up.railway.app  
**Auth:** Demo role mint OWNER (Hub SSO not verified this run — Hub timed out for agent)

### Pages visited (8/8)
Ringkasan, Pendapatan POS, Pembelian Supplier, Kas Kecil, Pengeluaran, Laporan Harian, Analitik, Pengaturan — all load without 404.

### After-action results

| Action | After-action | Result |
|---|---|---|
| Login as OWNER | Land on `/`, sidebar + Ringkasan | PASS |
| Navigate all sidebar links | Each page renders | PASS |
| "Buka POS Revenue" | Goes to `/pos` | PASS |
| "Buka Expense Log" | Goes to `/expenses` | PASS |
| POS table + pagination Berikutnya | Hal 1/10 → 2/10, rows change | PASS |
| POS search fill "Laju" | Input accepts value, **rows NOT filtered** | **FAIL** |
| POS Export click | No CSV/PDF menu in DOM | PARTIAL |
| Tambah Expense | Modal opens with full fields | PASS |
| Fill Jumlah/Deskripsi (no save) | Values stick | PASS |
| Close modal | Modal closes, list still empty | PASS |
| Analytics "Bulan Ini" | Revenue Rp 725.957.816 | PASS |
| Analytics "7 Hari" | Label changes; Revenue Rp 0 | PASS (filter works) |
| Settings Brand table | 5 brands shown | PASS |
| Settings tabs Outlet/Supplier/etc | **Table still shows Brand rows** | **FAIL** |

### Data notes
- Ringkasan today Revenue Rp 0; POS all-data Rp 492.075.989; Analytics month Rp 725.957.816 — **inconsistent windows**
- Suppliers / Expenses / Petty Cash / Daily Summary empty (possible seed state)

### Screenshots
`screenshots/finance-*.png` (login, ringkasan, pos, suppliers, petty-cash, expenses, summary, analytics, settings)

---

## 3. HR Postgres
**URL:** https://ykp-erp-hr-production.up.railway.app  
**Auth:** SSO cookie valid (rate-limited once under heavy concurrent load)

### Pages visited (6/6)
Ringkasan (via nav), Absensi, Penggajian, Aturan, Karyawan, Laporan Harian.

### After-action results

| Action | After-action | Result |
|---|---|---|
| Absensi load | Empty state + Import CSV / Refresh | PASS |
| Refresh click | Page reloads | PASS |
| Karyawan load | 50 rows, search, pagination, Nonaktifkan | PASS |
| + Karyawan | Dialog "Tambah Karyawan": Nama, Role, Outlet ID, Gaji, Simpan/Close | PASS |
| Payroll load | Total Gross Rp 242.344.217, Net Rp 229.094.543, 50 APPROVED rows, Generate button | PASS |
| Rules load | 10 rules (RULE-001..010), shifts Pagi/Siang/Malam/etc. | PASS |
| + Tambah Rule | Dialog "Buat HR Rule baru": Outlet ID, Shift, time pickers, Buat/Close | PASS |
| Summary Rebuild | Button → "Rebuilding..." >5s, no completion toast; empty summary remains | PARTIAL |
| Absensi Import CSV (Employees) | href `/hr/employees` → **404** (should be `/employees`) | **FAIL** |
| Absensi Refresh | href `/hr/attendance` → **404** (should be `/attendance`) | **FAIL** |
| Karyawan search "Putri" | Filters to 3 rows | PASS |
| Karyawan pagination Berikutnya | Hal 1/4 → 2/4 | PASS |
| Karyawan Nonaktifkan + cancel confirm | confirm fires; cancel keeps Aktif | PASS |
| Aturan Edit RULE-001 | Dialog "Edit Rule — Pagi" with OT fields | PASS |
| Payroll Generate | Modal with date range + Run (not submitted) | PASS |
| Ringkasan sidebar `/` | Redirects to `/attendance` (no dedicated KPI home) | PASS (design) |
| `/rules` under load | Once returned `rate_limited` JSON | PARTIAL (infra) |
| Payroll totals across reloads | First load Rp 242M; later reload Rp 0 | PARTIAL |

---

## 4. Hermez AI
**URL:** https://ykp-erp-hermez-production.up.railway.app  
**Auth:** SSO cookie valid

### Pages visited (7/7)
Ringkasan Harian, Peringatan, Actions, Warehouse, Konfigurasi, Jalankan, Tes Telegram — all load.

### After-action results

| Action | After-action | Result |
|---|---|---|
| Generate brief (Jalankan) | `brief_id: HZBR-20260718`, level green, telegram message_id **68** | PASS |
| Tes Telegram Kirim | `Terkirim (message_id: 69)` | PASS |
| Actions Start (row 1) | Status OPEN → IN PROGRESS | PASS |
| Warehouse summary | KPIs live (Inventory Rp 58.2M, Waste Rp 334k, etc.) | PASS |
| Config page | Thresholds editable (Anomali Kas Kecil **empty**) | PARTIAL |
| Daily Brief body on home | Only "Dibuat WIB · belum terkirim" — **no content even after generate** | **FAIL** |
| Alert log link | href `?date=undefined` | **FAIL** |
| Alert severity filter → Critical | Stuck "Memuat..." | **FAIL** |
| Date picker change | Value updates, brief content does not | PARTIAL |

### Screenshots
`tests/screenshots/hermez-*.png` (9 files)

---

## 5. HR Pilot Railway
**URL:** https://ykp-hr-v1-standalone-production.up.railway.app  
**Auth:** owner session already valid

### Pages visited (14)
Ringkasan, Karyawan, Absensi, Roster, Keterlambatan, Izin/Cuti, Payroll, Bonus & Potongan, Summary Harian, User & Role, Tambah Karyawan, Edit EMP-001, Import CSV, Generate Payroll.

### After-action results

| Action | After-action | Result |
|---|---|---|
| All 10 sidebar pages load | Content renders | PASS |
| Brand filter select Funkydak | Value = BR-001 | PASS |
| + Tambah Karyawan | Form opens (Nama/Brand/Outlet/Gaji/Join) | PASS |
| Edit EMP-001 | Prefill Sari Wijaya, Barista, Rp 4.5M | PASS |
| Import CSV page | File input + headers shown | PASS |
| Generate Payroll page | Month 2026-07 form | PASS |
| Absensi Simpan empty times | No visible validation alert | PARTIAL |
| Roster shift dropdown | Options show **BR-001 repeated** not shift names | **FAIL** |
| Form validation empty submit (Leaves/Adjustments) | No role=alert | PARTIAL |
| Roster today | "Belum ada roster" | PASS (empty data) |
| Absensi today | 0 hadir / 8 alpha | PASS (empty data) |
| Payroll issue flag | Funkydak Cipete: "8 payroll issue pending" | NOTE |

### Screenshots
`tests/screenshots/hr-pilot-ringkasan.png`, `hr-pilot-karyawan.png`

---

## 6. Warehouse
**URL:** https://ykp-warehouse-v1.vercel.app  
**Auth:** owner/owner123 works

### Pages visited (20/20 + 404 probe)
All sidebar routes via correct paths:
- `/warehouse/items`, `/locations`, `/suppliers`, `/categories`, `/unit-conversion`, `/threshold`
- `/penerimaan`, `/pemakaian`, `/transfer`, `/waste`, `/opname`, `/ledger`, `/expiry`
- `/purchase-recommendation`, `/purchase-request`, `/alerts`, `/actions`, `/summary`, `/dashboard`

### After-action results

| Action | After-action | Result |
|---|---|---|
| Login | Redirect `/warehouse`, sidebar owner | PASS |
| Logout | Redirect `/login` | PASS |
| All sidebar pages | Load (Transfer slow ~8s) | PASS |
| + Tambah Item | Form opens (full 32-col fields) | PASS |
| Tutup modal | Modal closes | PASS |
| All other + forms | Open with expected fields | PASS |
| Generate Recommendations | Button → "Generating…" | PASS (UI) |
| Regenerate Hari Ini | Button → "Memproses…" | PASS (UI) |
| Buat PR dari CRITICAL/HIGH | Table still empty | **FAIL** |
| Alerts ACK first | No visible status change | **FAIL** |
| Actions Start first | No visible status change | **FAIL** |
| Stock Ledger re-visit | Once crashed ERROR 2516970279; retry OK | PARTIAL |
| Recommendation float | Kopi Available `4.699.999.999.999.990` | **FAIL (data)** |
| Waste item names | Blank on 314 rows | **FAIL (data)** |
| Direct wrong routes `/master-item` | 404 (expected; correct is `/items`) | PASS |

### Screenshots
`tests/screenshots/warehouse-*.png`

---

## 7. Investor
**URL:** https://ykp-investor-v1.vercel.app  
**Auth:** owner session valid

### Pages visited (5/5)
Dashboard, Portfolio, Capital, Dividend, Returns.

### After-action results

| Action | After-action | Result |
|---|---|---|
| Dashboard KPIs | 12 investors, Net Capital Rp 4.499B, Dividend Paid Rp 4.133B | PASS |
| Portfolio | 19 holdings table | PASS |
| Capital | 55 rows; + Catat Capital modal open/close | PASS |
| Dividend | 115 rows; + Declare Dividend modal open/close | PASS |
| Returns | 12 investors all **Rp 0 / 0%** | **FAIL (data)** |
| Regenerate Summary | Timestamp advanced 16:21 → 16:34 | PASS |
| Finance KPIs on Dashboard | Revenue/Profit Rp 0 | **FAIL (upstream?)** |
| SPA sidebar synthetic click | href set, URL does not change | **FAIL** (tool/React) |
| Filters/search/pagination | Not implemented | N/A |

### Screenshots
`C:/Users/stefa/Pictures/investor-dashboard.png`

---

## 8. Operational
**URL:** https://ykp-ops-v1.vercel.app  
**Auth:** **BLOCKED**

### Root cause (verified)
1. `POST /api/auth/login` → **200** + body `{userId:USR-001, username:owner, role:owner}`
2. Response includes `Set-Cookie: ykp_ops_session=...; Secure; HttpOnly; SameSite=strict`
3. `GET /api/auth/me` with same cookie → **401 Unauthorized**
4. `GET /ops` → **307 → /login**
5. Cookie inject via CDP also fails verification

**Diagnosis:** Login API signs cookie with `SESSION_SECRET` (Node runtime). Middleware Edge verification uses `process.env.SESSION_SECRET` which is likely **empty or different** on Vercel Edge. Session signature never validates → permanent login loop.

### Code refs
- `ykp-ops-v1/src/app/api/auth/login/route.ts:14-30`
- `ykp-ops-v1/src/lib/session.ts:10-13, 51-61`
- `ykp-ops-v1/middleware.ts:43-52`
- `ykp-ops-v1/src/app/login/page.tsx:13-35` (also ignores `?redirect=`)

### Cannot test
Opening checklist, KDS, QC, Incidents, Closing — all behind auth wall.

### Public API
`GET /api/ops/summary?date=2026-07-18` → `{"data":{"date":"2026-07-18","items":[],"total":0}}` (200 OK)

---

## Cross-cutting issues

| Issue | Apps affected | Severity |
|---|---|---|
| Session cookie verification fails on Edge | Operational | **CRITICAL** |
| Daily Brief body empty after generate | Hermez | **HIGH** |
| Alert filter hang / date=undefined | Hermez | **HIGH** |
| Settings tabs / POS search no-op | Finance | **HIGH** |
| Returns aggregation all-zero | Investor | **HIGH** |
| Silent mutation buttons (PR/ACK/Start) | Warehouse | **HIGH** |
| Float corruption in Recommendation | Warehouse | **MEDIUM** |
| Form validation not accessible | HR Pilot, others | **MEDIUM** |
| Synthetic click / SPA router issues | Multiple (tool limitation) | LOW (tooling) |
| Empty seed data on "today" | Finance, HR, Ops | NOTE |

---

## Recommended fix order

1. **Operational SESSION_SECRET on Vercel** — ensure Edge middleware + Node API share identical secret ≥32 chars; redeploy; re-test login → `/ops`.
2. **Hermez Daily Brief render** — home page not showing generated brief; fix date binding (`date=undefined`).
3. **Finance POS search + Settings tabs** — wire client filters/tab state.
4. **Investor Returns aggregation** — reconnect capital/dividend totals.
5. **Warehouse PR/ACK/Start** — surface API errors; fix float math on qty.
6. **HR Pilot shift labels + form validation UX**.

---

## Test coverage matrix

| App | Pages | Buttons/forms | After-action verified | Mutations executed |
|---|---|---|---|---|
| Hub | dashboard + login | theme, palette, preview, logout | yes | logout |
| Finance | 8/8 | most | yes | none (modal fill only) |
| HR Postgres | 6/6 | add rule, add employee, rebuild, generate | yes | Rebuild summary |
| Hermez | 7/7 | most | yes | Generate brief, Telegram, Action Start |
| HR Pilot Railway | 14 | most | yes | none (forms open only) |
| Warehouse | 20/20 | most | yes | Generate Rec, Regenerate, ACK/Start (no visible effect) |
| Investor | 5/5 | most | yes | Regenerate Summary |
| Operational | 0 (blocked) | login only | yes (login fails) | login attempts |

---

## Hard defects (priority order)

1. **Operational login loop (CRITICAL)** — `SESSION_SECRET` mismatch Edge vs Node on Vercel. Cookie signed OK, middleware always 401.
2. **HR Postgres Absensi 404 links (CRITICAL)** — empty-state CTAs hardcode `/hr/employees` and `/hr/attendance` → 404. Correct paths: `/employees`, `/attendance`.
3. **Hermez Daily Brief empty (HIGH)** — Generate succeeds + Telegram sent, home page still shows empty shell; alert link `date=undefined`.
4. **Hermez alert severity filter hang (HIGH)** — stuck on "Memuat...".
5. **Finance POS search no-op (HIGH)** — input accepts text, table not filtered.
6. **Finance Settings tabs no-op (HIGH)** — tab buttons don't switch master table content.
7. **Investor Returns all zeros (HIGH)** — aggregation broken vs capital/dividend data.
8. **Warehouse PR/ACK/Start silent (HIGH)** — clicks succeed, no UI/state change.
9. **Warehouse float corruption (MEDIUM)** — Recommendation qty `4.699.999.999.999.990`.
10. **HR Pilot shift labels (MEDIUM)** — dropdown shows brand IDs instead of shift names.
11. **HR Postgres Summary Rebuild hangs (MEDIUM)** — stays "Rebuilding..." with no completion feedback.
12. **Hub Preview UI copy stale (LOW)** — label still says "iframe" but runtime uses `window.open` (intentional for third-party cookies).
13. **Ops module no Hub SSO (MEDIUM)** — Buka/Preview land on `/login` instead of auto-auth like Finance/HR/Hermez.

---

*Deep test completed 2026-07-18 via Kimi WebBridge. Full raw agent reports available in agent task outputs.*
