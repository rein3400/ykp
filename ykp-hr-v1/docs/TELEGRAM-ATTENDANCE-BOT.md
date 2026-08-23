# YKP HR V1 — Telegram Bot (Employee + Management)

> Last updated: 2026-08-23
> Status: LIVE di VPS `187.52.124.40`, systemd `ykp-hr-v1` (port 3002) +
> `ykp-hermez` (management bot, long-poll + gateway :3020).
> Webhook employee bot: `https://oseedigital.tech/api/hr/attendance/telegram`

## Topologi 2 bot

| Bot | Token env | Dipakai siapa | Jalur |
|---|---|---|---|
| **@justatestermaybot** (Employee) | `TELEGRAM_EMPLOYEE_BOT_TOKEN` (fallback `TELEGRAM_BOT_TOKEN`) | Semua karyawan semua cabang/divisi | Webhook → ykp-hr-v1 |
| **@ykpchataibot** (Management) | `TELEGRAM_MANAGEMENT_BOT_TOKEN` (fallback `TELEGRAM_BOT_TOKEN`) | Owner + kepala cabang (brand_manager/outlet_manager/supervisor dst.) | Long-poll di ykp-hermez |

Kedua token ada di `.env` masing-masing service. Menu perintah didaftarkan
lewat `ykp-hr-v1/scripts/set-commands.mjs` (idempotent, jalankan ulang
setelah ubah registry `telegram-commands.ts`).

## Sumber identitas: `users.telegram_id`

**Single source of truth = kolom `telegram_id` di tab `users`.**
Kolom `master_employee.telegram_id` hanya dibaca sebagai fallback legacy
(absen lama) — TIDAK ditulis lagi dari mana pun.

Alur pairing:

1. Karyawan login aplikasi web HR → menu **Telegram** → klik "Hubungkan".
2. Web membuat kode 6 digit (`telegram_link_codes`, TTL 10 menit).
3. Karyawan kirim `/link KODE` ke @justatestermaybot.
4. Bot memanggil `/api/hr/telegram/link/consume` → `users.telegram_id`
   terisi chat id karyawan tersebut. Satu chat id = satu orang.

Cek status link semua karyawan: halaman **Master Karyawan** di web
(kolom *Telegram*: ✓ linked / Belum link).

Resolusi lintas divisi (owner yang juga punya akun investor/ops):
`POST /api/hr/telegram-identity` mengembalikan semua binding untuk satu
chat id; role tertinggi (weight) dipakai untuk keputusan akses management.

## Notifikasi broadcast (gateway)

Semua broadcast (daily brief, alert HIGH/CRITICAL) tidak lagi kirim ke
`TELEGRAM_CHAT_ID` statis. Alurnya:

```
module app (hr/finance/warehouse/investor)
  → POST http://127.0.0.1:3020/api/internal/send   (x-bot-secret)
  → gateway Hermez resolve penerima via GET /api/hr/telegram-recipients?roles=...
  → fan-out via MANAGEMENT bot (@ykpchataibot)
  → log: /home/dev/ykp/ykp-hermez/data/notify-gateway-log.ndjson
```

- Aktif/nonaktif per app: env `USE_NOTIFY_GATEWAY=true` +
  `NOTIFY_GATEWAY_URL=http://127.0.0.1:3020`. Kalau gateway mati,
  app otomatis fallback ke jalur lama (langsung Telegram API).
- Penerima dinamis by role dari tab `users` (hanya yang sudah link
  Telegram dan aktif). Default roles=`owner`; boleh kirim `roles=owner,
 brand_manager` dsb., plus filter `brand_id`.
- Auth antar service: header `x-bot-secret` = nilai `TELEGRAM_BOT_SECRET`.

---

## Spreadsheet (sumber data)

Link: https://docs.google.com/spreadsheets/d/1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg/edit

Spreadsheet ID: `1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg`

> Catatan: produksi sekarang berjalan di Postgres (`USE_POSTGRES=true`,
> DB `ykp_v1`); spreadsheet tinggal sumber skema/migrasi.

---

## Geofence (radius outlet)

Geofence **per-outlet** — tiap outlet punya koordinat + radius sendiri
(`latitude`, `longitude`, `attendance_radius_m`).

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
muncul di HP. Di desktop tombol itu tidak dirender — bot punya fallback:
teks "Kirim Lokasi" dijawab instruksi desktop, bukan "perintah tidak dikenali".

---

## Perintah Employee bot

- `/start` `/help` — menu utama + bantuan
- `/link KODE` — hubungkan akun (kode dari web)
- `/masuk` — absen masuk (wajib lokasi)
- `/pulang` — absen pulang
- `/absen` — sub-menu absensi
- `/jadwal` — jadwal shift minggu ini
- `/cuti` — ajukan cuti/izin
- `/me` — profil & kehadiran hari ini

## Perintah Management bot (@ykpchataibot)

- `/brief` — daily brief AI
- `/alerts` — alert aktif
- `/watch` — status watch rules
- `/link` / `/help` — pairing & bantuan
Chat bebas (tanya jawab data via LLM) hanya untuk owner + kepala bagian.

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
- App path: `/home/dev/ykp/ykp-hr-v1` (employee bot) dan
  `/home/dev/ykp/ykp-hermez` (management bot + gateway).
- Service manager: systemd — `sudo systemctl restart ykp-hr-v1` /
  `ykp-hermez` (build dulu: `npm run build`).
- Env file: `<app>/.env` masing-masing.
- Webhook secret employee bot: `TELEGRAM_WEBHOOK_SECRET`
  (header `X-Telegram-Bot-Api-Secret-Token`).
- nginx route: `/api/hr/attendance/telegram` → `localhost:3002`
  (sebelum catch-all `/api/hr/*`).
