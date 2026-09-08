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
- [x] 4.3 Cron terpasang (23:00 WIB, sesuai platform deploy) + `.env.example` diperbarui dengan placeholder + komentar setup

## 5. Cutover & Hardening

- [ ] 5.1 Paralel run 1 hari: jalankan API untuk tanggal X dan bandingkan vs CSV manual tanggal X (per outlet; selisih = blocker)
- [ ] 5.2 Aktifkan cron (`MOKA_SYNC_ENABLED=true`), pantau 3 hari, lalu tetapkan tanggal cutover CSV
- [ ] 5.3 Rotasi client secret ketiga app (Developer Dashboard → update `.env` tanpa commit)
- [ ] 5.4 Verifikasi akhir: `npm run lint` + typecheck + `npm test` lulus; smoke manual endpoint sync (1 outlet, 1 hari)