# Proposal: moka-live-sync

## Why

Data penjualan Moka masuk ke sistem lewat ekspor + unggah CSV manual per outlet — rawan lupa, telat, dan memperlambat rekonsiliasi harian (food_cost_% warehouse, expected_cash finance, jawaban Hermez "menu terlaris"). Kini akses Moka Open API sudah tersedia: 3 Private App terdaftar, satu per outlet (Sekar Pizza Tirtodipuran, Funkydak Colombo, Suburbuns Colombo).

## What Changes

- Sinkronisasi harian otomatis di `ykp-finance-v1`: tarik `GET /v2/outlets/{id}/reports/sales_summary` + `GET /v3/outlets/{id}/reports/item_sales` per outlet → tulis ke tab Sheets `fin_pos_daily` / `fin_pos_items` yang sudah ada (source `moka`, integer IDR, dedup per date+outlet+item).
- OAuth2: tukar `code` → `access_token`/`refresh_token` sekali (endpoint one-time setup), simpan `refresh_token` di tab `app_settings`, auto-refresh saat expired.
- Mapping outlet: `outlet_id` Moka ↔ `OL-NNN` internal, disimpan di `app_settings`.
- Trigger: endpoint admin (manual/one-click) + slot cron platform (Railway/Vercel) — jadwal default 23:00 WIB (tutup kas).
- Guard cutover: jalankan paralel 1 hari — bandingkan hasil API vs CSV manual sebelum CSV dimatikan.
- Read-only terhadap Moka: tidak ada pemanggilan `checkouts` / `advanced_orderings`.

## Capabilities

### New Capabilities
- `finance/moka-sync`: ingest otomatis penjualan Moka via Open API — otorisasi + penyimpanan/refresh token, sinkronisasi per outlet (sales summary + item sales), mapping outlet internal, dedup, penanganan kuota/error, dan audit log setiap sinkronisasi.

### Modified Capabilities
<!-- Tidak ada: perilaku konsumen hilir (Hermez, Owner, warehouse rules-engine) tidak berubah — mereka tetap baca tab yang sama. -->

## Impact

- **Kode**: `ykp-finance-v1` — `src/lib/` (klien Moka + token store + mapper), `src/app/api/finance/pos/` (endpoint sync admin), `src/middleware.ts` (allowlist endpoint sync, tetap butuh session admin), `.env.example` (placeholder 6 var per-outlet).
- **Data**: tab Sheets `fin_pos_daily`, `fin_pos_items`, `app_settings` (token + mapping), `audit_log`.
- **Hilir**: Hermez `get_sales_items`, Owner `/penjualan`, `food_cost_%` warehouse — antarmuka tidak berubah, hanya lebih segar.
- **Dependensi**: tanpa dependensi baru (fetch stdlib). Tanggal Moka format `DD/MM/YYYY` perlu adaptor ke `YYYY-MM-DD`.
- **Keamanan**: client secret hanya di `.env` (gitignored); refresh token di `app_settings`; dilarang menulis secret ke kode/docs/audit. Kredensial sudah pernah lewat chat — rotasi setelah integrasi stabil.
- **Terbuka (diselesaikan di design)**: dukungan grant `client_credentials` vs wajib authorization-code; base URL resmi; bentuk respons aktual; batas kuota/rate limit (`GET /v1/quotas`); mekanisme cron final.