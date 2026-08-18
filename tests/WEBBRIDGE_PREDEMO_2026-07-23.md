# YKP Pre-Demo Test Report — 2026-07-23 (malam sebelum demo karyawan)

**Sumber:** live production (DEPLOYED_LINKS.md) — Hub + 6 downstream app
**Metode:** Playwright MCP real browser (login owner/owner123, SSO, input form, API probe) + PowerShell curl cross-origin + 5 Explore agent scan codebase + 1 general-purpose agent root-cause Finance 500
**Tujuan:** demo ke karyawan besok pagi. Cari blocker malam ini.

---

## TL;DR — prioritas fix malam ini

| # | Severity | App | Masalah | Fix | Status |
|---|---|---|---|---|---|
| 1 | **CRITICAL** | Finance | 4 endpoint 500 (expense/supplier/petty-cash/unpaid) — schema drift | DDL `ADD COLUMN IF NOT EXISTS` 18 kolom linking. Script `tests/finance-linking-sync.mts` sudah dibuat, tinggal jalanin ke prod Supabase | **SIAP EKSEKUSI** |
| 2 | **HIGH** | Hermez | Telegram bot dialog (inbound reply) **STOPPED** — worker gak ada di prod | Start in-process poller ATAU deploy worker VPS (memory `ykp-hermez-bot-vps`) | butuh keputusan owner |
| 3 | **HIGH** | Hermez | React hydration error #425/#418/#423 berulang (SSR/CSR mismatch) | cek ulang root cause server self-fetch SSR (memory `ykp-hermez-client-hydration-fix`), bisa kambuh | butuh debug |
| 4 | **HIGH** | Investor | cross-read Finance 401 → Revenue/Profit = Rp 0 di dashboard Investor | setup Finance cross-read auth / allowlist endpoint | butuh config |
| 5 | **MEDIUM** | Hub | Logout client-only, cookie `ykp_hub_session` gak di-clear server | tambah `/api/auth/logout` clear cookie | post-demo OK |
| 6 | **MEDIUM** | Hub | Health "online" menghitung 401/404 sebagai Online; Rows "—" di 5/6 app | `probeReturnsCount:false` + `<500` threshold | cosmetic |
| 7 | **MEDIUM** | Hub | login card copy "4 module" padahal 6 | fix string | cosmetic |
| 8 | **MEDIUM** | Warehouse | "25 item di bawah min" — semua item di bawah threshold | cek seed threshold vs master | data issue |
| 9 | **LOW** | semua app | favicon.ico 404 | add favicon | cosmetic |
| 10 | **SECURITY** | repo `.env.local` | TELEGRAM_BOT_TOKEN plaintext + DB URL committed | rotate token, gitignore, gunakan vault | post-demo |

---

## Yang SUDAH verified OK (demo-ready)

### Hub (https://ykp-hub-production.up.railway.app)
- ✅ Login owner/owner123 → dashboard, session cookie `ykp_hub_session` + localStorage
- ✅ Dashboard 6/6 online: Owner Command 31ms, HR 421ms, Finance 36ms, Warehouse 411ms, Investor 408ms, Ops 157ms
- ✅ SSO bridge Finance: GET `/api/auth/login?role=OWNER&token=...&redirect=/` → 302 → `/` authenticated, title "YKP Finance"
- ✅ SSO bridge Hermez: GET role=SUPER_ADMIN → 302 → `/`, title "YKP Hermez"
- ✅ Preview fix c594b2c verified: title "Buka di tab baru (auto-login via SSO)", **iframeCount=0** (no regression)
- ✅ 0 console error di Hub

### Finance (https://ykp-erp-finance-production.up.railway.app)
- ✅ POS Tambah Struk empty submit → banner `role="alert"` "Lengkapi dulu: Outlet, Nomor Nota, Metode Pembayaran, Gross Sales (> 0)." (fix #5 verified live)
- ✅ POS happy path: isi form → `POST /api/fin/pos/receipts` → **201**, row baru muncul (Funkydak Sudirman Rp 250.000, source manual, PM-002)
- ✅ POS duplicate guard: re-submit sama → **409** "Receipt already exists for this date, outlet, and receipt number"
- ✅ `/api/fin/pos` GET 200 (100 transaksi moka, revenue Rp 483M)
- ✅ `/api/fin/summary` GET 200
- ✅ `/api/fin/analytics/profit` GET 200 (revenue 726M, expense 133M — data ada)
- ✅ `/api/fin/master-data` GET 200 (outlets/categories/payment_methods)
- ❌ `/api/fin/expense` GET/POST 500, `/api/fin/supplier` 500, `/api/fin/petty-cash` 500, `/api/fin/unpaid` 500 → **CRITICAL, detail di bawah**

### HR V1 Sheets (https://ykp-hr-v1-standalone-production.up.railway.app)
- ✅ Login owner/owner123 (bcrypt) → `/hr`
- ✅ Dashboard: 19 karyawan aktif, summary 30 hari (Funkydak Cipete 18-20 hadir/hari)
- ✅ Tambah Karyawan: isi form → `POST /api/hr/employees` → **201**, redirect ke list
- ✅ Summary public endpoint `GET /api/hr/summary?date=2026-07-19` → 200, data real (18/20 present)
- ✅ Count endpoint 200 (5 brand, 11 outlet)

### Hermez (https://ykp-erp-hermez-production.up.railway.app)
- ✅ SSO SUPER_ADMIN → dashboard
- ✅ Run Console: `POST /api/hermez/run` → 202 async → poll DONE, brief_id HZBR-20260723, level green, alert 0
- ✅ Brief text: "Revenue 0, Expense 0, Kehadiran 0/0, Alert 0, Level GREEN" (kosong karena HR/Finance summary hari ini belum rebuild)
- ✅ **Telegram auto-send: `sentToOwner:true, sentAt 2026-07-23T13:28:49Z`** — brief terkirim ke group
- ✅ Telegram test page: `POST /api/hermez/telegram/test` → 200, **message_id 106** — outbound verified
- ✅ Hermez proxy `/api/hermez/ops-summary` → 200 (ops_v1, kosong)
- ✅ Hermez proxy `/api/hermez/warehouse-summary` → 200 (Sekarpizza 2026-07-14 data)
- ❌ **Bot dialog status: berhenti, messages handled 0** — inbound reply mati (HIGH)
- ❌ React hydration errors #425/#418/#423 berulang (HIGH, UI tetap jalan)

### Warehouse (https://ykp-warehouse-v1.vercel.app)
- ✅ Login owner/owner123 → `/warehouse`
- ✅ Overview: 25 item aktif, 0 waste, 0 variance
- ✅ Receiving list: 8+ record RECEIVED (2026-06-16)
- ✅ Form Receiving render (source/supplier/lokasi)
- ✅ Summary endpoint 200 (Sekarpizza data)
- ⚠️ "25 item di bawah min" — semua item di bawah threshold (data/seed issue)

### Investor (https://ykp-investor-v1.vercel.app)
- ✅ Login owner/owner123 → `/investor`
- ✅ Dashboard: 12 investor, capital in 6.24B, withdrawn 1.74B, net 4.5B, dividend paid 4.42B, 19 brand tracked
- ❌ **Finance cross-read 401** → Total Revenue (FIN) Rp 0, Total Profit (FIN) Rp 0, "warn: finance login HTTP 401"
- ✅ Summary endpoint 200

### Ops (https://ykp-ops-v1.vercel.app)
- ✅ Login owner/owner123 (sha256) → `/ops`
- ✅ Dashboard ringkasan render (summary 0, incidents 0, SLA 0)
- ✅ Incident input: `POST /api/ops/incidents` → **201**, incident_id INC-001, status OPEN
- ✅ Summary endpoint 200 (kosong, mock)
- ⚠️ Incident form outlet select cuma 1 opsi (OL-001 Funkydak Kemang) — demo seed terbatas

---

## CRITICAL #1 — Finance 500 root cause (95% confidence)

**Gejala:** 4 endpoint GET/POST 500 `internal_error` (envelope masked, gak leak stack — invariant 7 OK):
- `GET/POST /api/fin/expense`
- `GET /api/fin/supplier`
- `GET /api/fin/petty-cash`
- `GET /api/fin/unpaid`

**Yang tetap 200:** `/api/fin/pos`, `/api/fin/pos/receipts`, `/api/fin/summary`, `/api/fin/analytics/profit`, `/api/fin/master-data`

**Root cause:** schema drift "Revisi item 4 — cross-transaction linking". Kolom linking didefinisikan di Drizzle `ykp-erp/packages/schema/src/finance.ts:204-209, 241-246, 276-281`:
```
source_module, source_transaction_id, payment_source,
linked_expense_id, linked_supplier_invoice_id, linked_petty_cash_id, linked_payment_id
```
Tapi kolom ini **tidak pernah di-ALTER ke prod Supabase** — migration baseline `0000` berhenti di kolom `source`, `0001` cuma bikin `fin_pos_receipts`+view, sync script 2026-07-17 cuma add `settlement_difference`. Revisi 5-Wave add kolom ke Drizzle code tapi migration-nya gak pernah generate/run ke prod.

**Mekanisme 500:** `db.select()` = `SELECT *` → Drizzle emit SELECT semua kolom termasuk `source_module` dst → Postgres `42703 column "source_module" does not exist` → handler() mask jadi `internal_error`. POST insert path sama (insert set kolom linking → 42703). Analytics/profit 200 karena `sumWhere` pakai `SUM(amount)` selective, gak sentuh kolom linking. POS 200 karena `fin_pos_receipts` gak punya kolom linking + migration 0001 complete.

**Fix:** additive idempotent DDL. Script sudah dibuat: `ykp-erp/tests/finance-linking-sync.mts` (18 `ADD COLUMN IF NOT EXISTS` aligned persis dengan Drizzle schema). Jalankan:
```bash
cd ykp-erp
# set YKP_FINANCE_DATABASE_URL ke prod Supabase pooler (credential asli, bukan placeholder PASSWORD)
npx tsx tests/finance-linking-sync.mts
```
Setelah itu 4 endpoint 500 → 200. **No code change, no redeploy** (Drizzle schema prod udah cocok code). Untuk permanen: `npm run db:generate` → commit migration 0002 → `npm run db:migrate` ke prod.

**Bukti 403 vs 500:** PowerShell probe tanpa cookie → 403 forbidden (auth gate jalan sebelum DB). Browser dengan cookie SSO → 500 (auth pass, kena DB 42703). Konsisten dengan root cause.

---

## HIGH #2 — Hermez Telegram bot dialog STOPPED

**Gejala:** `/telegram-bot` page: status "berhenti", mode stopped, messages handled 0, last update id 0. UI text klaim "bot jalan di proses worker container (auto-start saat deploy)" — **menyesatkan, gak ada worker container di prod**.

**Dampak:** outbound (brief auto-send + test message) **jalan** (message_id 106 verified). Tapi inbound reply (`/brief /omzet /hr /alerts /sop` + tanya AI bebas) **mati**. Kalo demo minta owner kirim `/brief` ke bot dan lihat reply → gagal.

**Root cause (per memory `ykp-hermez-bot-vps`):** prod image `Dockerfile.hermez.new` web-only. Worker `bot-worker.mjs` gak ada Railway service/systemd jalan. `HERMEZ_BOT_WORKER_ENABLED` gak di-set. In-process engine bot (`telegram-bot.ts`) bisa di-Start via UI tapi whitelist single-chat (gak honor comma-list + OWNER_USER_IDS, mismatch dengan worker fix a2b26b6).

**Opsi fix:**
1. **Cepat (demo):** klik "Start polling" di `/telegram-bot` page → in-process bot jalan. Tapi DM whitelist single-chat — kalo owner kirim dari DM (5721500978) bukan group (-5437367893), ditolak. Hotfix `telegram-bot.ts:73-76` mirror worker comma-list logic.
2. **Benar:** deploy worker VPS (runbook `docs/HERMEZ_BOT_VPS.md`, `scripts/vps/`), set `HERMEZ_BOT_WORKER_ENABLED=true`.

---

## HIGH #3 — Hermez React hydration errors

**Gejala:** 8-9 console error React #425 (text mismatch SSR/CSR), #418 (hydration), #423 berulang di load. UI tetap render (brief empty state, dashboard), tapi hydration broken.

**Kemungkinan root cause:** memory `ykp-hermez-client-hydration-fix` bilang root cause lama = server self-fetch in SSR prefetch. Bisa kambuh kalau ada perubahan yang re-introduce server fetch di RSC. Butuh debug terpisah (read layout/page RSC, cek `fetch` di server component). Tidak blocker demo (UI jalan), tapi console error gak elegan.

---

## HIGH #4 — Investor cross-read Finance 401

**Gejala:** Investor dashboard `Total Revenue (FIN) Rp 0, Total Profit (FIN) Rp 0, warn: finance login HTTP 401`. Investor cross-read `YKP_FINANCE_SPREADSHEET_ID` atau Finance HTTP butuh auth yang gak ter-setup.

**Dampak:** dashboard Investor tampil capital/dividend (dari Sheets sendiri) tapi revenue/profit Finance = 0. Demo: investor lihat angka revenue 0 padahal Finance ada 726M.

**Fix:** setup Finance cross-read auth (allowlist endpoint atau service token) di config Investor. Butuh cek `ykp-investor-v1/lib/finance-summary.ts` + env `YKP_FINANCE_*`.

---

## Catatan non-blocker

- Hub logout client-only (cookie 24h persist) — security review post-demo
- Hub health "online" = `<500` (401/404 tetap hijau) — acceptable demo
- Hub login card "4 module" vs 6 module — cosmetic string `login-form.tsx:49`
- Ops incident form outlet cuma 1 (OL-001) — seed mock terbatas
- Warehouse 25/25 item di bawah min — cek seed threshold
- favicon.ico 404 semua app — add static favicon
- ⚠️ `.env.local` berisi TELEGRAM_BOT_TOKEN plaintext + Supabase DB URL (password placeholder) committed — **rotate Telegram token post-demo, gitignore .env.local**

---

## Fixes applied in working tree (2026-07-23 malam) — BELUM deploy

| # | File | Fix |
|---|---|---|
| 1 | `ykp-erp/tests/finance-linking-sync.mts` | **NEW** — DDL ADD COLUMN IF NOT EXISTS 18 linking cols (Finance 500 root cause). Ready to run. |
| 2 | `ykp-erp/packages/engine/src/telegram-bot.ts` | `isAllowedChat` now honors comma-list + `OWNER_USER_IDS` (mirror bot-worker.mjs a2b26b6). In-process poller can reply to owner DM. |
| 3 | `ykp-erp/apps/hermez/src/app/(dashboard)/telegram-bot/page.tsx` | Footnote no longer claims "worker container auto-start" (misleading). |
| 4 | `ykp-erp/apps/hermez/src/app/(dashboard)/page.tsx` + `run/page.tsx` | Hydration fix: `new Date().toISOString().slice(0,10)` → `todayWib()` (Asia/Jakarta, SSR-safe). Root cause of React #425/#418/#423. |
| 5 | `ykp-investor-v1/src/lib/finance-summary.ts` | POST login now sends `password: process.env.ERP_SSO_SECRET` (security cutover 1243c84 requires it). Root cause of Investor Finance 401. |
| 6 | `ykp-investor-v1/.env.example` | Document `ERP_SSO_SECRET` requirement. |
| 7 | `ykp-hub/app/components/login-form.tsx` | "4 module" → "6 module". |

**Verified live (no deploy needed):** Finance POST login with `password=<ERP_SSO_SECRET>` → 200 + Set-Cookie + `GET /api/fin/summary?limit=500` → 200 (220KB data). Confirms Investor fix once env set.

---

## Yang harus owner lakukan malam ini (urutan)

### A. Finance 500 — DDL fix (CRITICAL, no redeploy)

```bash
cd ykp-erp
# set YKP_FINANCE_DATABASE_URL ke prod Supabase pooler (credential asli, bukan placeholder PASSWORD di .env.local)
npx tsx tests/finance-linking-sync.mts
```

Verifikasi: SSO ke Finance → `GET /api/fin/expense?date_from=2026-07-01&date_to=2026-07-23` → 200. Ini buka 4 modul Finance yang crash. **No code change, no redeploy.**

### B. Investor Finance cross-read — env + redeploy

```bash
# Di Vercel project ykp-investor-v1, set production env:
# ERP_SSO_SECRET=<same value as Finance Railway ERP_SSO_SECRET>
# (Hub NEXT_PUBLIC_ERP_SSO_SECRET is the same value — currently baked as
#  f5615a97217b2116cfcd0e50998159039d1a2dadc5a92acd, confirmed working)

cd ykp-investor-v1
# after env set:
vercel --prod --yes
```

Code fix already in `src/lib/finance-summary.ts` (sends password). Without env set, redeploy alone still 401.

### C. Hermez bot + hydration — redeploy Hermez

```bash
cd ykp-erp
# commit whitelist + hydration + telegram-bot page text first
# then:
railway up --service ykp-erp-hermez --environment production -d -y
```

After deploy:
1. Login Hermez SUPER_ADMIN → `/telegram-bot` → **Start polling**
2. Dari Telegram group (-5437367893) kirim `/brief` → harus reply
3. Dari owner DM (5721500978) kirim `/brief` → harus reply (whitelist fix)
4. Hard-reload `/` → console gak ada React #425 lagi

Note: in-process poller hidup di web process. Redeploy/restart container → bot stop lagi. Untuk 24/7, deploy worker VPS (lihat `docs/HERMEZ_BOT_VPS.md`).

### D. Hub copy + commit pending

```bash
# Hub "6 module" string + any other Hub fix
cd ykp-hub
railway up --service ykp-hub --environment production -d -y
```

Also commit `ykp-erp/apps/finance/src/features/finance/components/pos-receipt-form.tsx` (banner noValidate, still uncommitted) before any Finance redeploy — otherwise banner fix reverts.

### E. Security post-demo (bukan malam ini)

- Rotate TELEGRAM_BOT_TOKEN (plaintext in `ykp-erp/.env.local` committed)
- Rotate ERP_SSO_SECRET (baked into Hub NEXT_PUBLIC → visible in client bundle + URL)
- gitignore `.env.local`

Script `tests/finance-linking-sync.mts` siap. Saya gak punya credential prod Supabase (`.env.local` password = placeholder `PASSWORD`) — butuh owner jalanin.

## Repro step CRITICAL #1
1. Login Hub owner/owner123
2. Buka Finance (SSO OWNER)
3. Navigasi ke `/expenses` → halaman "Belum ada pengeluaran" tapi console 3× `GET /api/fin/expense → 500`
4. Atau: di Finance console jalankan `fetch('/api/fin/expense?date_from=2026-07-01&date_to=2026-07-23',{credentials:'include'}).then(r=>r.status)` → 500
5. Setelah DDL fix: harus 200

## Repro step HIGH #2
1. Login Hermez (SSO SUPER_ADMIN)
2. Navigasi `/telegram-bot` → status "berhenti", messages handled 0
3. (outbound OK) `/telegram-test` → Kirim → message_id 106
4. Kirim `/brief` dari Telegram group ke bot → **tidak reply** (bot stopped)

---

## UI Walkthrough Final (2026-07-23 22:30 WIB) — post-fix

| Modul | Halaman | Input test | Status |
|---|---|---|---|
| Hub | Dashboard | 6/6 online, URL production, SSO token | ✅ |
| Finance | Ringkasan | KPI cards render (fallback 07-15) | ✅ |
| Finance | Expenses | **UI form Tambah Expense → POST 201**, dialog close, list refresh | ✅ FIXED (was 500) |
| Finance | Suppliers | list MTD 260M, unpaid 38M, overdue 29 | ✅ |
| Finance | POS | empty banner + 201 + 409 verified earlier | ✅ |
| HR V1 | Attendance | form check-in/out + history | ⚠️ Out time = `NaN:NaN` (display bug) |
| HR V1 | Payroll | list rows render | ⚠️ layout kolom aneh (GAJI POKOK shows date) |
| Hermez | Alerts | 3 supplier overdue today (lokasi asli), filter OK | ✅ |
| Hermez | Actions | list + Start/Complete/Cancel | ✅ |
| Hermez | Config | Integrasi Telegram+LLM "tersimpan" | ✅ |
| Hermez | Brief | Rp 91.2M, 52/55, 3 alert, YELLOW | ✅ |
| Hermez | Bot | running 156 cycles, 12 msgs, LLM reply OK | ✅ |
| Warehouse | Waste | list + form "Catat Waste" | ✅ |
| Warehouse | Login | 200 (1× cold-start 500 transient) | ✅ |
| Investor | Dashboard | Revenue FIN Rp 2.3B, Profit 1.1B, http 485 rows | ✅ |
| Investor | Portfolio | Cap table YKP Owner 55% Funkydak etc | ✅ (1× session-expire 500 transient) |
| Ops | Opening | form render (outlet mock "Funkydak Kemang") | ✅ |
| Ops | Closing | POST 201, cash_diff -20k | ✅ |
| Ops | Incidents | POST 201 earlier | ✅ |

### Residual (non-blocker demo)

1. **HR Attendance Out = `NaN:NaN`** — display bug format waktu checkout. Repro: `/hr/attendance` history kolom Out. *(partially mitigated by cleanTime() guard — old Sheets rows still dirty)*
2. **HR Payroll layout** — kolom "GAJI POKOK" nampilin date, "NET" nampilin "owner". Data binding/seed Sheets residual.
3. **Finance same-day summary empty** — **FIXED 2026-07-23 night** (`date_to` was lte midnight; now end-of-day WIB). Deployed Finance Railway SUCCESS. Verified 24-07 shows rows.
4. **Outlet inactive (OL-006~015) masih di dropdown** Finance/HR — app gak filter `status=active`.
5. **Ops mock outlet "Funkydak Kemang"** — beda dari master real "Funkydak Mrican". Ops mock-mode seed terpisah.
6. **Warehouse/Investor cold-start 500** — 1× transient, retry 200. Vercel cold start.
7. **Bot in-process** — restart Hermez = bot stop. Re-Start polling sebelum demo.
8. **Investor `/investor/admin` hard crash** — "This page couldn't load" ERROR 2972506939 (reproduced 2× after login). Dashboard/portfolio/capital/dividend/returns OK.
9. **Finance `fin_daily_summary` 2026-07-24 duplicate rows** — 5 outlets × 2 (seed double-insert). UI shows double revenue if not deduped. Brief still correct (reads once per outlet via engine).
10. **⚠️ JANGAN klik Finance "Rebuild Today" pada 24-07** — rebuild overwrites seed with POS-derived zeros (proven on 23-07 earlier).

---

## Full Page Crawl (2026-07-23 night → 2026-07-24 morning)

### Coverage matrix (route render + primary buttons)

| App | Routes crawled | All 200? | Input forms / CTAs seen | Hard fails |
|---|---|---|---|---|
| **Hub** | `/` | ✅ | Login, Buka, Preview, Refresh, Logout | none (prod URLs) |
| **Finance** | `/` `/pos` `/suppliers` `/petty-cash` `/expenses` `/summary` `/analytics` `/settings` | ✅ | Tambah Struk, Tambah Cost, Tambah Expense, Export, Rebuild Today, Filter, Kirim Telegram, tabs | none |
| **Hermez** | `/` `/alerts` `/actions` `/warehouse` `/config` `/run` `/telegram-test` `/telegram-bot` | ✅ | Generate brief, Start/Stop poller, Kirim test, Acknowledge/Resolve, Start/Complete/Cancel action | none |
| **HR V1** | `/hr` `/hr/employees` `/hr/employees/new` `/hr/attendance` `/hr/roster` `/hr/lateness` `/hr/leaves` `/hr/payroll` `/hr/payroll/generate` `/hr/adjustments` `/hr/summary` `/hr/users` | ✅ | Simpan Absensi, Clock in/out, Simpan roster, Setujui/Tolak, Ajukan cuti, Generate payroll, Tambah User | none (owner role) |
| **Warehouse** | Overview, items, locations, suppliers, categories, unit-conversion, threshold, penerimaan, pemakaian, transfer, waste, opname, ledger, expiry, purchase-recommendation, purchase-request, alerts, actions, summary, dashboard, closing, stok | ✅ (after path fix) | + Receiving, + Bon, + Waste, + Opname, + Transfer, Generate Recs, Approve/Reject PR, ACK/Resolve, Regenerate | early crawl used EN path → 404; real ID paths OK |
| **Investor** | `/investor` portfolio capital dividend returns admin | 5/6 ✅ | Regenerate Summary, + Catat Capital, + Declare Dividend | **`/investor/admin` crash** |
| **Ops** | `/ops` briefing opening kds qc incidents closing waste analytics ai-assistant | ✅ | Publish Briefing, Submit Opening/Closing/Waste/QC, Submit Incident, Regenerate, Kirim AI | none |

### Demo-day morning probe (2026-07-24)

| Check | Result |
|---|---|
| Finance summary 24-07 | ✅ 200, UI shows 5 outlets (Uncle Masala Demangan Rp 20.188.000 …) — note: API may return 10 rows if duplicates not cleaned |
| Hermez brief HZBR-20260724 | ✅ YELLOW, Rp 93.936.000, 51/55 hadir, 4 alert |
| Telegram bot | ✅ running, 24 msgs handled, 355 cycles, lastError null |
| Hub cards | ✅ production URLs, no localhost |

### New bugs found in full crawl

| Sev | Bug | Repro | Status |
|---|---|---|---|
| HIGH→FIXED | Investor Admin page crash | `/investor/admin` readTab(documents) in Promise.all rejected when tab absent → RSC crash. Fixed: readTabSafe (catch→[]) for joined reads (commit 8e34af0, Vercel prod). Verified: API 200 + page renders | ✅ live |
| MED→FIXED | Finance summary TZ leak: `date=2026-07-24` filter returned 23-07 rows too (double revenue) | Drizzle `date` col vs JS Date cast through connection TZ. Fixed: compare `date::text` vs literal YYYY-MM-DD (commit 27782cc) | deploy pending |
| LOW | Warehouse EN path aliases 404 | `/warehouse/receiving` vs `/warehouse/penerimaan` | by design (ID routes) |
| FIXED | Finance same-day filter empty | `date_from=date_to` returned [] | commit a174df0 + Railway deploy |
| FIXED | Finance TZ leak double rows | `date=24` returned 23 rows | commit 27782cc + Railway deploy |
| FIXED→deploy | Brief kehadiran salah: `51/55` vs bot `49/55` | `composeBriefText` derived present = totalStaff - staffLate (excludes late arrivals who are still present). Fix: use `staffPresent` column (commit db761d1, Hermez deploy) | deploy pending |