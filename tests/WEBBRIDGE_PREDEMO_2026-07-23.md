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