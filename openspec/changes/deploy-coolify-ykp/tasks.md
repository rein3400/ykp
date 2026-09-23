## 1. Dockerfile yang belum ada

- [x] 1.1 Buat `ykp-finance-v1/Dockerfile` meniru `ykp-ops-v1/Dockerfile` (build-time `USE_MOCK_DB=true` + placeholder `SESSION_SECRET`, expose + start `:3003`)
- [x] 1.2 Buat `ykp-owner-v1/Dockerfile` (Next 16 standalone, build-time mock agar `next build` lolos tanpa sibling URL, expose + start `:3010`)
- [ ] 1.3 DEFERRED (Opsi B): `ykp-hermez` broken di `main` (5 file sumber hilang, lengkap hanya di `mom-1sep-fixes`) — service 11 ditunda, notifikasi via ERP `bot-worker.mjs`
- [x] 1.4 Verifikasi: `tsc --noEmit` + `vitest` tiap app; `next build` finance/hr/owner/warehouse/ops/investor sukses (`docker build` full hang tanpa output di mesin ini — verifikasi via `npm run build` dgn env yg sama)

## 1b. Pulihkan file provider yang hilang (R1, akar: revert `95f38b8`)

- [x] 1b.1 Checkout dari `origin/mom-1sep-fixes`: `finance/{notify-gateway,settings,concurrency}.ts`, `hr/{attendance-lookup,notify-gateway}.ts`, `warehouse/{notify-gateway,db/postgres}.ts`, `investor/{notify-gateway,db/postgres}.ts`, `ops/db/postgres.ts`
- [x] 1b.2 Pulihkan `finance/src/lib/audit.ts` chain-hash (`computeChainHash`, `verifyAuditChain`) dari `95f38b85^`
- [x] 1b.3 Bersihkan unused import (`readTab`, `TABS`) di `finance/src/lib/concurrency.ts`
- [x] 1b.4 Verifikasi: `tsc` bersih finance/hr/warehouse/ops/investor; `next build` 6/6 sukses; vitest warehouse 121/121, ops 10/10, investor 55/55, owner 37/37; finance 130/133 + hr 88/89 — sisa gagal pre-existing di file tak tersentuh (`approval.ts`, `moka-importer.ts`, `telegram-attendance.ts`)

## 2. Native `YKP_DB_PLAIN_TCP` di `clients.ts`

- [x] 2.1 Tambah pembacaan `YKP_DB_PLAIN_TCP === "true"` → `ssl: false` di `ykp-erp/packages/schema/src/db/clients.ts` (default tak berubah)
- [x] 2.2 Hapus baris `sed`-patch dari `Dockerfile.coolify.{hr,finance,hermez}` beserta komentar `ponytail:`
- [x] 2.3 Verifikasi: `tsc --noEmit` workspace ERP + `grep -r "sed -i" ykp-erp/Dockerfile.coolify.*` kosong

## 3. Hub lepas-localhost

- [x] 3.1 Hapus blok `rewrites()` di `ykp-hub/next.config.mjs` (audit: nol konsumen path relatif)
- [x] 3.2 Ganti fallback `http://187.52.124.40` di `ykp-hub/app/config.ts` dengan `requiredUrl()` (throw bila env kosong); hapus juga fallback `localhost:3002` di `app/api/auth/login/route.ts`
- [x] 3.3 Dockerfile hub diverifikasi lengkap (6 URL + SSO `ARG→ENV`); `NEXT_PUBLIC_APP_URL`/`HERMEZ_URL` tidak dipakai kode — tanpa perubahan
- [x] 3.4 Verifikasi: `next build` hub sukses + `rg` bundle nol `187.52.124.40` dan nol `localhost:300`

## 4. Env per service (diinput di dashboard Coolify, nama saja)

- [ ] 4.1 finance-v1: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `YKP_FINANCE_SPREADSHEET_ID`, `SESSION_SECRET`, `CRON_SECRET`, `ENVIRONMENT`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_SECRET`, `MOKA_SYNC_ENABLED=false`, `MOKA_SYNC_SECRET`, `MOKA_OUTLETS` + `MOKA_<KEY>_{CLIENT_ID,CLIENT_SECRET,OUTLET_ID}` (nilai disalin dari `ykp-finance-v1/.env` lokal), `MOKA_SYNC_ENABLED=true`, opsional mirror PG (`USE_POSTGRES=true` + `DATABASE_URL`)
- [ ] 4.2 hr-v1: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `YKP_HR_SPREADSHEET_ID`, `SESSION_SECRET` (unik), `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `YKP_HUB_ORIGIN` (domain hub baru — gantikan default IP lama agar iframe hub diizinkan)
- [ ] 4.3 warehouse: `GOOGLE_*`, `YKP_WAREHOUSE_SPREADSHEET_ID`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ENVIRONMENT`, `TELEGRAM_BOT_SECRET` (sama dengan 4.1), `YKP_HUB_ORIGIN` (domain hub baru)
- [ ] 4.4 ops: `GOOGLE_*`, `YKP_OPS_SPREADSHEET_ID`, `SESSION_SECRET`, `ENVIRONMENT`, AI (`LLM_*`/`OPENAI_*` sesuai `src/lib/ai.ts`)
- [ ] 4.5 investor: `GOOGLE_*`, `YKP_INVESTOR_SPREADSHEET_ID`, `SESSION_SECRET`, `FINANCE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ENVIRONMENT`, `YKP_HUB_ORIGIN` (domain hub baru)
- [ ] 4.6 owner: `YKP_{HR,FINANCE,WAREHOUSE,OPS,INVESTOR}_URL` (domain final Phase 2), `SESSION_SECRET`, `TELEGRAM_BOT_SECRET` (sama dengan 4.1), `YKP_OWNER_MOCK=false`
- [ ] 4.7 hub (build-time): `NEXT_PUBLIC_YKP_{OWNER,HR,FINANCE,WAREHOUSE,INVESTOR,OPS}_URL`, `NEXT_PUBLIC_ERP_SSO_SECRET`, `NEXT_PUBLIC_APP_URL`; runtime: `ERP_SSO_SECRET`, `HUB_SESSION_SECRET`, `SESSION_SECRET`
- [ ] 4.8 erp hr/finance/hermez: `YKP_{MASTER,HR,FINANCE,HERMEZ}_DATABASE_URL` (internal Postgres), `YKP_DB_PLAIN_TCP=true`, `CRON_SECRET`, `ERP_SSO_SECRET` (sama dengan 4.7), Telegram, Supabase bila dipakai
- [ ] 4.9 hermez-bot: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_IDS`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `YKP_{FINANCE,HR,WAREHOUSE,OPS,INVESTOR}_URL`, `TELEGRAM_BOT_SECRET`

## 5. Deploy Phase 1 — Postgres + ERP internal

- [ ] 5.1 Buat project "YKP" di Coolify + Postgres managed; catat internal hostname
- [ ] 5.2 Deploy erp-hr, erp-finance, erp-hermez (base_directory repo root, tanpa domain publik); jalankan `db:migrate`
- [ ] 5.3 Verifikasi: log migrate advisory-lock OK; health endpoint tiap app 200 via internal network

## 6. Deploy Phase 2 — modul tulis V1

- [ ] 6.1 Deploy hr-v1, finance-v1, warehouse, ops (base_directory subdirektori, domain publik + env 4.1–4.4)
- [ ] 6.2 Bootstrap Sheets bila kosong (`sheets:bootstrap`), `seed-user`, lalu ROTATE kredensial default `owner/owner123`
- [ ] 6.3 Verifikasi: `/login` 200 tiap service; tulis-baca roundtrip (`sheets:smoke`) lolos

## 7. Deploy Phase 3 — aggregator

- [ ] 7.1 Deploy owner dengan URL final Phase 2; deploy hub dengan build args final; deploy investor
- [ ] 7.2 Verifikasi: hub health probe 6/6 hijau; owner dashboard render data live (bukan mock — cek label sumber)

## 8. Deploy Phase 4 — background

- [ ] 8.1 Deploy hermez-bot (token + LLM); daftarkan cron eksternal untuk daily-brief (header `x-cron-secret` / `CRON_SECRET` per modul)
- [ ] 8.2 Aktifkan Moka live sync di produksi: `MOKA_SYNC_ENABLED=true` (data terbaru 2026-09-09, 3 outlet, cron 16:00 UTC test-fire lulus); update GitHub secrets `YKP_FINANCE_URL` → domain Coolify finance + `MOKA_SYNC_SECRET` agar workflow `moka-daily-sync.yml` menembak host baru
- [ ] 8.3 Verifikasi: test-fire cron 1x; log telegram delivery tercatat

## 9. Smoke akhir + serah terima

- [ ] 9.1 Smoke: `GET /api/hr/summary?date=`, `/api/warehouse/summary`, `/api/ops/summary`, `/api/investor/summary`, hermez proxy — semua 200
- [ ] 9.2 Perbarui `DEPLOYED_LINKS.md` dengan URL Coolify final + catat kredensial mana yang sudah di-rotate
- [ ] 9.3 Putar ulang kredensial dashboard Coolify yang sempat lewat channel chat; tutup akses register publik bila memungkinkan
