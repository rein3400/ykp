# Design: moka-live-sync

## Context

`ykp-finance-v1` (Next 16 + Sheets, aktif) sudah punya seluruh infrastruktur yang dibutuhkan: `src/db/sheets.ts` (readTab/appendRows/updateRow/findRow + `app_settings`), `src/lib/moka-importer.ts` (parser CSV, pola dedup per date+outlet), middleware dengan pola secret header (`x-finance-secret`), dan tab target `fin_pos_daily`/`fin_pos_items`. Spec Moka resmi (v0.2, ReDoc `api-docs-prod.json`) menyediakan OAuth2 (`POST /oauth/token`), laporan `sales_summary` (v2), `item_sales` (v3), `get_latest_transactions` (v4), dan `GET /v1/quotas`. Tanggal Moka berformat `DD/MM/YYYY`. Tiga Private App sudah terdaftar (satu per outlet); kredensial hanya di `.env` (gitignored).

## Goals / Non-Goals

**Goals:**
- Satu jalur ingest API yang menggantikan CSV manual, per-outlet terisolasi (satu gagal, lain jalan)
- Token lifecycle mandiri: otorisasi sekali, refresh otomatis, re-auth jelas bila ditolak
- Cutover aman: paralel dengan CSV 1 hari, rollback lewat satu env flag

**Non-Goals:**
- Menulis apa pun ke Moka (checkouts, advanced orderings, modifikasi)
- Mengubah konsumen hilir (Hermez/Owner/warehouse — mereka baca tab yang sama)
- Sinkronisasi real-time/intraday (V1: harian, tutup kas ~23:00 WIB)
- Migrasi tab atau perubahan skema `fin_pos_*`

## Decisions

1. **Sync hidup di `ykp-finance-v1`, bukan `etl/` (Python).** Etl scaffold punya runtime terpisah, tak punya akses auth/Sheets/audit, dan keluarannya CSV — bukan pemutusan masalah. Alternatif ditolak: menambah runtime baru untuk pekerjaan yang milik app pemilik tab.

2. **OAuth authorization-code sebagai flow utama; `client_credentials` diverifikasi lewat 1 panggilan nyata sebelum implementasi token store.** Spec hanya mendokumentasikan penukaran `code`→token dan refresh; scaffold lama berasumsi client-credentials tanpa dasar. Task pertama adalah spike verifikasi: jika client-credentials didukung, otorisasi jadi tanpa klik owner; jika tidak, butuh satu kali authorize via App Market per app (3 klik owner, hasil token disimpan permanen + refresh).

3. **Kredensial per outlet via env prefix, mapping via `app_settings`.**
   ```
   MOKA_SEKARPIZZA_TIRTODIPURAN_CLIENT_ID / _CLIENT_SECRET / _OUTLET_ID
   MOKA_FUNKYDAK_COLOMBO_CLIENT_ID / _CLIENT_SECRET / _OUTLET_ID
   MOKA_SUBURBUNS_COLOMBO_CLIENT_ID / _CLIENT_SECRET / _OUTLET_ID
   ```
   `app_settings` menyimpan `moka_outlet_map`: `{"moka_outlet_id": "OL-NNN"}` dan `moka_token:<moka_outlet_id>`: `{access_token, refresh_token, expires_at}`. Alternatif satu env list dinilai lebih rapuh terhadap salah urutan.

4. **Pemicu: satu endpoint admin + secret header untuk cron.** `POST /api/finance/pos/sync` menerima `{date?, outlet?}` — sesi admin untuk manual, atau header `x-moka-sync-secret` = `MOKA_SYNC_SECRET` untuk platform cron (pola sama dengan `FINANCE_NOTIFY_SECRET`). Alternatif cron in-process ditolak: platform ini deploy ke Railway/Vercel, jadwal bawaan platform gratis dan idempoten.

5. **Penulisan memakai helper Sheets yang ada; upsert per (date, outlet[, item]).** Baca tab sekali per run, bangun indeks kunci, updateRow untuk yang ada, appendRows batch untuk baru — meniru pola `moka-importer.ts` dan menghindari N+1 `findRow` (pelajaran dari `5d1b5e9`). Kuota tulis Sheets 60/menit aman: 3 outlet × ≤2 tab per hari.

6. **Guard sumber tunggal di impor CSV.** Route impor CSV menolak (atau menandai) baris untuk tanggal yang sudah ada baris `source=moka` — mencegah dobel hitung saat paralel run dan setelah cutover.

7. **Tanpa dependensi baru.** `fetch` global (Next 16), `parseIdrAmount` sudah ada untuk arah sebaliknya; konversi `DD/MM/YYYY→YYYY-MM-DD` beberapa baris di lib. `ponytail:` HTTP client dibungkus fungsi kecil satu file (`src/lib/moka-client.ts`) — bila respons aktual menyimpang dari spec, hanya satu file yang diubah.

## Risks / Trade-offs

- [Bentuk respons aktual ≠ spec v0.2] → spike 1 panggilan nyata sebelum token store; parser defensif + test fixture dari respons nyata.
- [`client_credentials` tidak didukung] → alur authorize 3 klik via App Market; refresh token panjang umur membuatnya sekali seumur app.
- [Secret sudah lewat chat] → rotasi semua secret setelah paralel run stabil (task terakhir).
- [Kuota/rate limit Moka] → cek `/v1/quotas` sebelum batch; jeda antar-outlet; tanpa retry agresif (sync ulang manual murah).
- [Refresh token tersimpan di `app_settings` (bisa dibaca admin Sheets)] → diterima untuk V1 (ponytail); naikkan ke secret manager saat lebih dari satu merchant atau akses melebar.
- [Jam sinkron vs jam tutup kas outlet tidak seragam] → endpoint menerima `date` eksplisit; cron per outlet bisa diatur belakangan tanpa perubahan desain.

## Migration Plan

1. Isi `.env` (6+ var) + `MOKA_SYNC_SECRET`; spike otorisasi + 1 panggilan nyata (ground truth).
2. Deploy endpoint sync (manual-only, `MOKA_SYNC_ENABLED=false` artinya 404).
3. Paralel 1 hari: jalankan API untuk tanggal X, bandingkan vs CSV manual tanggal X (nilai per outlet; selisih = blocker).
4. Aktifkan cron (`MOKA_SYNC_ENABLED=true`); CSV masih boleh untuk tanggal < cutover.
5. Setelah stabil 3 hari: rotasi secret; CSV tetap tersedia sebagai fallback manual.
- Rollback: `MOKA_SYNC_ENABLED=false` — endpoint off, CSV kembali satu-satunya jalur; tidak ada perubahan skema untuk dibalikkan.

## Open Questions

- ~~Platform cron final~~ → **diputus**: GitHub Actions `moka-daily-sync.yml` (16:00 UTC = 23:00 WIB, pola hermez-daily-brief), butuh repo secrets `YKP_FINANCE_URL` + `MOKA_SYNC_SECRET`.
- ~~Dukungan grant~~ → **ground truth (spike 2026-09-08)**: `client_credentials` DIDUKUNG — token bearer 180 hari, base URL `https://api.mokapos.com` benar.
- ~~`725042` outlet?~~ → **business id**. Outlet nyata via `GET /v1/businesses/{business_id}/outlets`: Sekar Pizza Tirtodipuran = outlet **772618** (aktif), "Sekar Pizza Colombo" = 878538 (langganan habis 2025-12).
- ~~Bentuk respons laporan~~ → **masih tertutup**: v2/v3 mengembalikan 403 *"token isn't granted scope: Laporan Merchant"* — owner harus mengaktifkan scope laporan pada app; parser tetap toleran + fixture ditukar saat scope aktif.
- App "Funkydak Colombo" & "Suburbuns Colombo" → `invalid_client` (401): kredensial perlu diverifikasi ulang owner di Developer Dashboard.