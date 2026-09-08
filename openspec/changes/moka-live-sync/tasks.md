# Tasks: moka-live-sync

## 1. Prasyarat & Spike Verifikasi

- [ ] 1.1 Owner/Env: isi `.env` ykp-finance-v1 — `MOKA_<OUTLET>_CLIENT_ID/_CLIENT_SECRET/_OUTLET_ID` (3 outlet), `MOKA_SYNC_SECRET`, `MOKA_SYNC_ENABLED=false` (tidak di-commit; `.env.example` dapat placeholder)
- [x] 1.2 Spike 1 panggilan nyata: verifikasi grant (client-credentials vs authorization-code), base URL, dan bentuk respons `sales_summary` (v2) + `item_sales` (v3); simpan respons sebagai test fixture (tanpa token/secret)
- [x] 1.3 Catat `moka_outlet_id` ketiga outlet dan petakan ke `OL-NNN` internal — **terpetakan: Sekar=772618, Funkydak=696752, Suburbuns=843676 (semua aktif); OL-NNN internal menunggu konfirmasi master_outlet saat deploy** (masukan `app_settings.moka_outlet_map`)

## 2. Klien Moka & Token

- [x] 2.1 Buat `src/lib/moka-client.ts`: tukar `code`→token (fallback client-credentials bila spike membuktikan didukung), refresh otomatis saat 401/expired, fetch wrapper Bearer + timeout, adapter tanggal `DD/MM/YYYY`→`YYYY-MM-DD`
- [x] 2.2 Token store di tab `app_settings` (`moka_token:<moka_outlet_id>`: access/refresh/expires_at), per-outlet; refresh ditolak → status "perlu otorisasi ulang" (tanpa retry loop)
- [x] 2.3 Unit test `moka-client`: refresh sukses, refresh ditolak, tanggal adapter, secret tidak pernah muncul di error/result (pakai fixture dari 1.2)

## 3. Sync Engine

- [x] 3.1 Mapper + normalizer: `moka_outlet_id`→`OL-NNN` (tidak terpetakan = entri error, dilewati), angka→integer IDR, `source='moka'`
- [x] 3.2 Sync `fin_pos_daily`: baca tab sekali, indeks (date,outlet), updateRow untuk ada / appendRows batch untuk baru (upsert idempoten)
- [x] 3.3 Sync `fin_pos_items`: upsert per (date, outlet, item)
- [x] 3.4 Guard sumber tunggal: route impor CSV menolak/menandai baris untuk tanggal yang sudah punya baris `source=moka`
- [x] 3.5 Cek `GET /v1/quotas` sebelum batch; error satu outlet tidak menghentikan outlet lain; hasil ringkas per outlet
- [x] 3.6 Unit test engine: sync normal, sync ulang tidak menduplikasi, outlet tak terpetakan, gagal per-outlet terisolasi, dobel-sumber CSV ditolak

## 4. Endpoint, Trigger, Audit

- [x] 4.1 `POST /api/finance/pos/sync` `{date?, outlet?}`: sesi admin ATAU header `x-moka-sync-secret`; gate `MOKA_SYNC_ENABLED` (off = 404); izinkan tanggal mundur untuk pemulihan
- [x] 4.2 Audit log per run (aktor/trigger, tanggal, hasil per outlet) + `logAudit` pola existing
- [ ] 4.3 Cron terpasang (23:00 WIB) + `.env.example` diperbarui dengan placeholder + komentar setup — **koreksi 2026-09-09: workflow `moka-daily-sync.yml` SUDAH DIBUAT tapi belum di-commit, dan target deploy (VPS) belum punya route-nya; cron dianggap "terpasang" saat 6.6 lulus**

## 5. Cutover & Hardening

- [ ] 5.1 Paralel run 1 hari: jalankan API untuk tanggal X dan bandingkan vs CSV manual tanggal X (per outlet; selisih = blocker)
- [ ] 5.2 Aktifkan cron (`MOKA_SYNC_ENABLED=true`), pantau 3 hari, lalu tetapkan tanggal cutover CSV
- [ ] 5.3 Rotasi client secret ketiga app (Developer Dashboard → update `.env` tanpa commit)
- [ ] 5.4 Verifikasi akhir: `npm run lint` + typecheck + `npm test` lulus; smoke manual endpoint sync (1 outlet, 1 hari)

## 6. Ramp-up produksi (VPS) — hasil eksplorasi 2026-09-09

Fakta deploy terverifikasi: produksi jalan di VPS `187.52.124.40` (bukan Railway/Vercel), repo di `/home/dev/ykp`, app dikelola systemd (`ykp-finance-v1.service`), branch `develop`, spreadsheet ID live terisi, **nol var `MOKA_*` di `.env` VPS**. Tiga garis sejarah saling lepas: origin `main`/`develop`/`stagging`, VPS `develop` = origin/develop + **22 commit belum di-push**, lokal `main` = origin/develop + 1 commit + seluruh kode moka uncommitted.

- [ ] 6.0 (G0) Push 22 commit VPS `develop` → `origin` (dari VPS: `git push origin develop`) — kode fix QA produksi saat ini hanya ada di VPS
- [ ] 6.1 (G1) Reconcile lokal: `git fetch`, rebase/merge lokal ke atas tip `origin/develop`, commit seluruh artefak moka (6 file untracked + 3 modified + `.github/workflows/moka-daily-sync.yml` + `openspec/changes/moka-live-sync/`) → push
- [ ] 6.2 (G2) Deploy VPS: `cd /home/dev/ykp && git pull origin develop && npm ci && npm run build && sudo systemctl restart ykp-finance-v1`
- [ ] 6.3 (G3) Isi 14 var `MOKA_*` + `MOKA_SYNC_ENABLED=true` di `/home/dev/ykp/ykp-finance-v1/.env` (nilai ada di `.env` lokal mesin dev; tanpa commit)
- [ ] 6.4 (G4) Smoke 1 outlet × 1 hari dari VPS → cek `audit_log` action `moka_sync` + tab `fin_pos_daily`/`fin_pos_items` terisi
- [ ] 6.5 (G5) = 5.1 paralel run vs CSV
- [ ] 6.6 (G6) Aktifkan cron — pilih salah satu: (a) commit `.github/workflows/moka-daily-sync.yml` + 2 repo secret (`YKP_FINANCE_URL`, `MOKA_SYNC_SECRET`), atau (b) crontab VPS pola proven: `0 23 * * *` curl localhost:3003 + `x-moka-sync-secret` → pantau 3 hari (= 5.2)
- [ ] 6.7 (G7) = 5.3 cutover CSV + rotasi secret → 5.4 verifikasi akhir → archive change