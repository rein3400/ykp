# YKP HR V1 — Telegram Absen Bot (Production)

> Last updated: 2026-08-18
> Status: LIVE di VPS `187.52.124.40`, PM2 app `ykp-hr-v1`, port `3008`.
> Webhook: `https://oseedigital.tech/api/hr/attendance/telegram`

## Spreadsheet (sumber data)

Link: https://docs.google.com/spreadsheets/d/1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg/edit

Spreadsheet ID: `1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg`

Semua data HR V1 (karyawan, outlet, absensi, payroll, user) disimpan di
spreadsheet ini. Bot Telegram baca/tulis langsung ke sini — bukan ke kode
atau file config.

---

## Setup chat id karyawan

Bot nyocokin chat id pengirim Telegram → kolom `telegram_id` di tab
`master_employee`. Kalau cocok, bot tau itu karyawan siapa + outlet mana +
role apa.

**Tempat setting: tab `master_employee`, kolom `telegram_id` (kolom H).**

### Langkah per karyawan

1. Buka spreadsheet (link di atas).
2. Tab `master_employee`.
3. Kolom `telegram_id` — isi dengan chat id Telegram karyawan itu.
4. Selesai. Tidak perlu restart bot, langsung kebaca.

### Cara dapet chat id tiap karyawan

Chat id = angka unik per akun Telegram. Cara paling gampang:

- Karyawan chat bot dulu (ketik `/start` atau `/help`), atau
- Pakai bot `@userinfobot` — karyawan forward pesan apa aja ke bot itu,
  dia balas chat id-nya.

### Catatan penting

- `telegram_id` harus **angka persis**, tanpa tanda kutip, tanpa spasi.
- Satu chat id = satu karyawan. Karyawan yang belum diisi tidak dikenali bot.
- Role karyawan diambil dari tab `users` (kolom `role`), bukan dari
  `master_employee`. Kalau karyawan harus bebas geofence (mis. HR admin),
  pastikan dia juga punya akun di tab `users` dengan role yang sesuai.

---

## Geofence (radius outlet)

Geofence **per-outlet** — tiap outlet punya koordinat + radius sendiri di
tab `master_outlet` (`latitude`, `longitude`, `attendance_radius_m`).
Karyawan di-match ke outlet-nya masing-masing, bukan satu koordinat global.

### Pengecualian role manajemen

Role berikut **bebas absen dari mana aja** (tidak terikat radius outlet):

- `owner`
- `super_admin`
- `hr_admin`
- `finance_admin`

Role lain tetap wajib dalam radius outlet:

- `employee`
- `supervisor`
- `outlet_manager`

Implementasi: `src/lib/attendance-service.ts` → `GEO_EXEMPT_ROLES`.

---

## Kirim lokasi di Telegram

Bot butuh lokasi untuk absen masuk. Cara kirim lokasi beda per platform:

| Platform | Cara kirim lokasi |
|---|---|
| HP (Android/iOS) | Tekan tombol "Kirim Lokasi" (reply keyboard) |
| Desktop | Klik ikon 📎 (paperclip) → Location → pilih titik di peta → kirim |

**Batasan Telegram:** tombol `request_location` ("Kirim Lokasi") hanya
muncul di HP. Di desktop tombol itu tidak dirender, jadi yang terkirim
cuma teks "Kirim Lokasi" — bukan koordinat.

Bot sudah handle fallback: kalau nerima teks "Kirim Lokasi", dia balas
instruksi cara kirim lokasi di desktop (bukan "perintah tidak dikenali").

---

## Perintah bot

- `/masuk` — absen masuk (wajib kirim lokasi)
- `/pulang` — absen pulang
- `/help` — bantuan + instruksi kirim lokasi

---

## Alur absen masuk

1. Karyawan kirim `/masuk`.
2. Bot minta lokasi.
3. Karyawan kirim lokasi (HP: tombol; desktop: 📎 → Location).
4. Bot cek radius vs outlet karyawan:
   - Dalam radius → tercatat `INSIDE_RADIUS`, status PRESENT.
   - Luar radius + role manajemen → tercatat `OUTSIDE_RADIUS`, status PRESENT.
   - Luar radius + role biasa → ditolak, minta koreksi manual.

---

## Env & deploy (referensi)

- VPS: `187.52.124.40`, user `dev`.
- App path: `/home/dev/ykp/ykp-hr-v1`.
- PM2: `pm2 restart ykp-hr-v1 --update-env`.
- Env file: `/home/dev/ykp/ykp-hr-v1/.env`.
- Webhook secret: `TELEGRAM_WEBHOOK_SECRET` (header `X-Telegram-Bot-Api-Secret-Token`).
- Caddy route: `/api/hr/attendance/telegram` → `localhost:3008` (sebelum catch-all `/api/hr/*`).
