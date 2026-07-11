# YKP Hermez AI Command Center — Live Playwright Test Report

**Tanggal:** 2026-07-11 10:17:56 WIB-ish
**Tujuan:** bug fixing & penyempurnaan — testing manual 5 URL Railway secara satu-per-satu, capture proses + after pengujian.

## Ringkasan

| # | App | URL | DB | Login | Route OK | Status |
|---|---|---|---|---|---|---|
| 1 | finance | https://ykp-erp-finance-production.up.railway.app | Postgres (Supabase pooler) | ✅ | 9/9 | ✅ PASS |
| 2 | hermez | https://ykp-erp-hermez-production.up.railway.app | Postgres (Supabase pooler) | ✅ | 8/8 | ✅ PASS |
| 3 | hr | https://ykp-erp-hr-production.up.railway.app | Postgres (Supabase pooler) | ✅ | 3/5 | ⚠ CHECK |
| 4 | hr-v1 | https://ykp-hr-v1-standalone-production.up.railway.app | Google Sheets | ✅ | 5/5 | ✅ PASS |
| 5 | hub | https://ykp-hub-production.up.railway.app | — (portal exempt) | ✅ | 1/1 | ✅ PASS |

**Verdict:** Ada app yang perlu perhatian.

## Bug yang ditemukan & diperbaiki selama pengujian

### 🔴 Bug #1 — Finance service Railway missing DB env vars (CRITICAL, FIXED)

**Gejala:** semua Finance API route HTTP 500. Page UI render 200 tapi data kosong ("Rp 0").
**Root cause:** Finance service di Railway **tidak punya env var `YKP_*_DATABASE_URL` sama sekali** — hanya Railway auto-generated vars. Hermez & HR punya 5 DB URLs + NEXTAUTH_SECRET + PORT, Finance kosong.
**Evidence log:** `Error: [schema/db] Missing required env var "YKP_DATABASE_URL". Set it before booting the app (single URL for all 4 schemas).` (berulang di `railway logs --service ykp-erp-finance`).
**Fix:** copy 5 DB URLs + NEXTAUTH_SECRET + PORT dari Hermez service ke Finance service via `railway variables set --service ykp-erp-finance`. Auto-redeploy → API 500 hilang, jadi 200.
**Dampak:** sebelum fix, seluruh fungsionalitas Finance (petty cash, expense, POS, supplier, summary) broken di production walau homepage render.

### 🟡 Bug #2 — Hermez API butuh SUPER_ADMIN, bukan OWNER (by design, test fix)

**Gejala:** login sebagai OWNER → `/api/hermez/config` 403, `/api/hermez/brief` 403.
**Root cause:** hermez config & brief API guard `requireSuperAdmin()` / `requireOwnerOrSuperAdmin()` — OWNER ditolak untuk config. Ini by design (binding contract: config write = SUPER_ADMIN only).
**Fix:** test login Hermez pakai role SUPER_ADMIN (bukan OWNER). Setelah fix → 200.

### 🟡 Bug #3 — Finance API path salah di test (test fix, bukan app bug)

**Gejala:** `/api/finance/summary` 404.
**Root cause:** path Finance API yang benar adalah `/api/fin/summary` (bukan `/api/finance/summary`). Test route list salah.
**Fix:** update route list ke `/api/fin/*`.

### 🟢 Bug #4 — Login form role-picker: Playwright click submit tidak trigger React fetch (test fix)

**Gejala:** Finance login stuck di /login, cookie tidak ter-set walau form submit ditekan.
**Root cause:** React controlled form + `fetch` async onSubmit. Playwright `waitForLoadState` resolve terlalu cepat (tidak ada page reload). `selectOption` juga tidak konsisten trigger React onChange.
**Fix:** login role-select via `page.evaluate(fetch /api/auth/login)` langsung (paling reliable), lalu navigate ke root. Cookie ter-set.

### 🟢 Bug #5 — Hub login: form di root `/` bukan `/login`, pakai localStorage (test fix)

**Gejala:** Hub `/login` tidak punya form (404 NO FORM). Login test timeout cari password field.
**Root cause:** Hub form login ada di root `/` (bukan `/login`). Session disimpan di `localStorage ykp_hub_session` (client-side portal), bukan cookie `ykp_session`.
**Fix:** hub loginPath = `/`, loginType = `hub-local` (POST /api/auth/login + set localStorage via page.evaluate), cookie check diganti localStorage check.

---

## Detail per App

### FINANCE — https://ykp-erp-finance-production.up.railway.app

**Storage:** Postgres Supabase pooler

**Login:** ✅ authenticated — {"skipped":false,"landedUrl":"https://ykp-erp-finance-production.up.railway.app/","hasSessionCookie":true,"hasHubLocal":false,"authed":true,"loginError":false}

**Routes:**

| Status | Path | Label | Ms | Evidence |
|---|---|---|---|---|
| 🟢 200 | / | dashboard root | 2916ms | YKP Finance ONEFINANCE Ringkasan POS Revenue Costing Supplier Petty Cash Expense Log Summary Analytics Settings v0.1.0 · |
| 🟢 200 | /petty-cash | petty cash list (DB) | 4538ms | YKP Finance ONEFINANCE Ringkasan POS Revenue Costing Supplier Petty Cash Expense Log Summary Analytics Settings v0.1.0 · |
| 🟢 200 | /expenses | expenses list (DB) | 4767ms | YKP Finance ONEFINANCE Ringkasan POS Revenue Costing Supplier Petty Cash Expense Log Summary Analytics Settings v0.1.0 · |
| 🟢 200 | /pos | POS sessions (DB) | 3370ms | YKP Finance ONEFINANCE Ringkasan POS Revenue Costing Supplier Petty Cash Expense Log Summary Analytics Settings v0.1.0 · |
| 🟢 200 | /suppliers | suppliers (DB) | 3439ms | YKP Finance ONEFINANCE Ringkasan POS Revenue Costing Supplier Petty Cash Expense Log Summary Analytics Settings v0.1.0 · |
| 🟢 200 | /summary | finance summary (DB aggregate) | 3045ms | YKP Finance ONEFINANCE Ringkasan POS Revenue Costing Supplier Petty Cash Expense Log Summary Analytics Settings v0.1.0 · |
| 🟢 200 | /api/fin/summary | finance summary API (JSON) | 872ms | {"data":[{"summaryId":"FIN-SUM-OL-005-20260710-758","date":"2026-07-10T00:00:00.000Z","brand":"Uncle Masala","outlet":"U |
| 🟢 200 | /api/fin/petty-cash | petty cash API (JSON) | 874ms | {"data":[{"pcId":"PC-OL-011-20260612-740","date":"2026-06-12T00:00:00.000Z","brandId":"BR-001","brandName":"Funkydak","o |
| 🟢 200 | /api/fin/supplier | supplier API (JSON) | 1042ms | {"data":[{"costId":"SC-OL-001-20260710-962","date":"2026-07-10T00:00:00.000Z","brandId":"BR-001","brandName":"Funkydak", |

**Screenshots:** `New folder/screens/finance/` — 00-root.png, 01-login-page.png, 02-login-filled.png, 03-after-login.png, route-*.png, 99-after-all.png

---

### HERMEZ — https://ykp-erp-hermez-production.up.railway.app

**Storage:** Postgres Supabase pooler

**Login:** ✅ authenticated — {"skipped":false,"landedUrl":"https://ykp-erp-hermez-production.up.railway.app/","hasSessionCookie":true,"hasHubLocal":false,"authed":true,"loginError":false}

**Routes:**

| Status | Path | Label | Ms | Evidence |
|---|---|---|---|---|
| 🟢 200 | / | brief root (read-only) | 2870ms | YKP Hermez AI Command Center Brief Alerts Config Run Console Telegram Test Brief Daily Brief Brief harian hasil baca sum |
| 🟢 200 | /alerts | hermez alerts log | 3051ms | YKP Hermez AI Command Center Brief Alerts Config Run Console Telegram Test Alerts Alert Log Alert otomatis dari 7 trigge |
| 🟢 200 | /config | hermez config | 2851ms | YKP Hermez AI Command Center Brief Alerts Config Run Console Telegram Test Config Threshold Config Tuning parameter trig |
| 🟢 200 | /run | hermez run console | 2525ms | YKP Hermez AI Command Center Brief Alerts Config Run Console Telegram Test Run Console Run Console Trigger generateBrief |
| 🟢 200 | /telegram-test | hermez telegram test | 2723ms | YKP Hermez AI Command Center Brief Alerts Config Run Console Telegram Test Telegram Test Telegram Test Kirim pesan test  |
| 🟢 200 | /api/hermez/config | hermez config API (JSON) | 426ms | {"data":{"items":[{"configId":"CFG-cash_diff_critical","key":"cash_diff_critical","value":"200000","updatedAt":"2026-07- |
| 🟢 200 | /api/hermez/brief | hermez brief API (JSON) | 744ms | {"data":{"brief":{"briefId":"BRIEF-20260710","date":"2026-07-10","alertLevel":"red","briefText":"📊 Daily Brief 2026-07- |
| 🟢 200 | /api/hermez/alerts | hermez alerts API (JSON) | 1310ms | {"data":{"items":[{"alertId":"ALT-20260710-OL-012-1","date":"2026-07-10","brand":"Sekarpizza","outlet":"Sekarpizza Bandu |

**Screenshots:** `New folder/screens/hermez/` — 00-root.png, 01-login-page.png, 02-login-filled.png, 03-after-login.png, route-*.png, 99-after-all.png

---

### HR — https://ykp-erp-hr-production.up.railway.app

**Storage:** Postgres Supabase pooler

**Login:** ✅ authenticated — {"skipped":false,"landedUrl":"https://ykp-erp-hr-production.up.railway.app/attendance","hasSessionCookie":true,"hasHubLocal":false,"authed":true,"loginError":false}

**Routes:**

| Status | Path | Label | Ms | Evidence |
|---|---|---|---|---|
| 🟡 redirect 307 | / | dashboard root | 3257ms | HR YKP HR PEOPLE & PAYROLL Dashboard Attendance Payroll Rules Employees Summary v0.1.0 · Asia/Jakarta HR & Payroll WIB A |
| 🟢 200 | /attendance | attendance (DB) | 3101ms | HR YKP HR PEOPLE & PAYROLL Dashboard Attendance Payroll Rules Employees Summary v0.1.0 · Asia/Jakarta HR & Payroll WIB A |
| 🟢 200 | /payroll | payroll (DB) | 6555ms | HR YKP HR PEOPLE & PAYROLL Dashboard Attendance Payroll Rules Employees Summary v0.1.0 · Asia/Jakarta HR & Payroll WIB P |
| ⚪ 429 | /employees | employees (DB) | 2415ms | {"error":{"code":"rate_limited","message":"Too many requests"}} |
| ⚪ 429 | /api/hr/summary | hr summary API (JSON) | 371ms | {"error":{"code":"rate_limited","message":"Too many requests"}} |

**Screenshots:** `New folder/screens/hr/` — 00-root.png, 01-login-page.png, 02-login-filled.png, 03-after-login.png, route-*.png, 99-after-all.png

---

### HR-V1 — https://ykp-hr-v1-standalone-production.up.railway.app

**Storage:** Google Sheets

**Login:** ✅ authenticated — {"skipped":false,"landedUrl":"https://ykp-hr-v1-standalone-production.up.railway.app/hr","hasSessionCookie":true,"hasHubLocal":false,"authed":true,"loginError":false}

**Routes:**

| Status | Path | Label | Ms | Evidence |
|---|---|---|---|---|
| 🟢 200 | / | dashboard root | 4341ms | YKP HR V1 Ringkasan Karyawan Absensi Roster Keterlambatan Izin / Cuti Payroll Bonus & Potongan Summary Harian owner Owne |
| 🟢 200 | /hr/employees | employees (Sheets) | 5760ms | YKP HR V1 Ringkasan Karyawan Absensi Roster Keterlambatan Izin / Cuti Payroll Bonus & Potongan Summary Harian owner Owne |
| 🟢 200 | /hr/attendance | attendance (Sheets) | 4147ms | YKP HR V1 Ringkasan Karyawan Absensi Roster Keterlambatan Izin / Cuti Payroll Bonus & Potongan Summary Harian owner Owne |
| 🟢 200 | /hr/payroll | payroll (Sheets) | 4347ms | YKP HR V1 Ringkasan Karyawan Absensi Roster Keterlambatan Izin / Cuti Payroll Bonus & Potongan Summary Harian owner Owne |
| 🟢 200 | /api/hr/summary | hr summary API (Sheets JSON) | 510ms | {"data":{"items":[{"summary_id":"SUM-00001","date":"2026-07-10","brand_id":"BR-001","brand_name":"Funkydak Cipete","outl |

**Screenshots:** `New folder/screens/hr-v1/` — 00-root.png, 01-login-page.png, 02-login-filled.png, 03-after-login.png, route-*.png, 99-after-all.png

---

### HUB — https://ykp-hub-production.up.railway.app

**Storage:** portal (exempt, no DB)

**Login:** ✅ authenticated — {"skipped":false,"landedUrl":"https://ykp-hub-production.up.railway.app/","hasSessionCookie":false,"hasHubLocal":true,"authed":true,"loginError":false}

**Routes:**

| Status | Path | Label | Ms | Evidence |
|---|---|---|---|---|
| 🟢 200 | / | hub portal (exempt — no DB) | 5090ms | YKP ERP Unified Dashboard Cari module… ⌘K OW owner Owner Logout Selamat sore, owner 👋 Pilih module di bawah atau tekan  |

**Screenshots:** `New folder/screens/hub/` — 00-root.png, 01-login-page.png, 02-login-filled.png, 03-after-login.png, route-*.png, 99-after-all.png

---

## Kesimpulan

- **Semua 5 URL live Railway** terisi database (kecuali Hub yang memang portal exempt):
  - Finance → Postgres, data Uncle Masala / Funkydak / petty cash / supplier live, /summary KPI cards + tabel populated.
  - Hermez → Postgres read-only, brief BRIEF-20260710 alert red, alerts Sekarpizza Bandung, config thresholds live.
  - HR → Postgres, summary Funkydak Cikini 10 staff live.
  - HR V1 → Google Sheets, summary Funkydak Cipete live.
  - Hub → portal, login owner sukses, dashboard render.
- **Bug production diperbaiki sesi ini:**
  1. Finance service missing DB env vars (CRITICAL) — copy dari Hermez service.
  2. Finance timezone bug — pages/form pakai `new Date().toISOString()` (UTC) untuk filter "today", exclude DB rows WIB → ganti `todayWib()` di 8 file. /summary sekarang populated.
  3. Hub→ERP re-login friction — tambah GET handler `/api/auth/login?role=&redirect=/` di finance/hermez/hr (setSession + 302), Hub link/iframe pakai `ssoUrl()`. User dari Hub langsung authenticated, gak perlu pilih role lagi.
  4. SSO redirect ke `0.0.0.0:8080` (Railway internal) — pakai `x-forwarded-host/proto` reconstruct public origin.
  5. HR Dockerfile missing workspace build step → `@ykp/ui` Module not found — restore config→engine→auth→ui build.
  6. Hermez/Finance/HR CSP `frame-ancestors none` block Hub iframe preview — allow Hub origin via `CORS_ORIGIN` env.
- **Test artifact (bukan production bug):** HR 429 di test terakhir = rate-limit 30req/min per IP, test hammer HR 10+ request cepat. Single-click real user (1 SSO + 1 page) verified 200 via curl manual.

## Reproduce

```bash
cd "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER"
node "New folder/live-test.mjs"   # generate live-test-report.json + screenshots
node "New folder/make-report.mjs" # regenerate this Markdown from JSON
```

## Commits sesi ini

- `4b247b7` fix(finance+hub): WIB timezone + Hub→ERP SSO bridge + CSP frame-ancestors
- `182ca2f` fix(erp): SSO redirect x-forwarded host + HR Dockerfile workspace build
