# Tutorial Koneksi Telegram — YKP Hermez

Panduan langkah-demi-langkah untuk menghubungkan akun Telegram **setiap divisi** dan **setiap karyawan** ke sistem YKP. Dirancang agar mudah dipahami oleh staf yang tidak terbiasa dengan teknologi.

---

## 📌 Ringkasan

Setiap divisi punya halaman **"Telegram"** di aplikasinya masing-masing. Dari sana, staf:

1. **Login** ke aplikasi divisi
2. Buka menu **Telegram**
3. Tap **"Dapatkan Kode"**
4. Tap **"Buka Telegram"** → otomatis terhubung (tanpa mengetik apa pun)

---

## 🧭 Halaman Telegram per Divisi

| Divisi | Aplikasi | Menu di Sidebar | Halaman |
|---|---|---|---|
| **HR** | ykp-hr-v1 | Telegram | `/hr/telegram` |
| **Finance** | ykp-finance-v1 | Kontrol → Telegram | `/finance/telegram` |
| **Warehouse** | ykp-warehouse-v1 | Alert & Summary → Telegram | `/warehouse/telegram` |
| **Ops** | ykp-ops-v1 | Telegram | `/ops/telegram` |
| **Investor** | ykp-investor-v1 | Telegram | `/investor/telegram` |

> **Catatan:** Semua divisi memakai **satu bot Telegram yang sama** (Hermez). Jadi setelah terhubung di satu divisi, akun kamu terhubung untuk semua divisi.

---

## 👤 Tutorial untuk Karyawan (semua divisi)

### Langkah 1 — Login ke aplikasi divisi
Buka aplikasi divisi kamu (mis. HR, Finance, Warehouse, Ops, atau Investor) dan login dengan akun kamu.

### Langkah 2 — Buka menu Telegram
Di menu samping (sidebar), cari dan klik **"Telegram"**.

### Langkah 3 — Dapatkan kode
Klik tombol **"Dapatkan Kode"**. Akan muncul **kode 6 karakter** (contoh: `ABC234`). Kode berlaku **10 menit**.

### Langkah 4 — Buka Telegram
Klik tombol **"Buka Telegram"**. Telegram akan terbuka dan bot otomatis menghubungkan akun kamu. **Kamu tidak perlu mengetik apa pun.**

### Langkah 5 — Selesai
Bot akan mengonfirmasi bahwa akun kamu terhubung. Sekarang kamu bisa:
- ✅ **Absen** (clock-in / clock-out) via Telegram
- 📅 **Lihat jadwal** shift
- 🏖 **Ajukan cuti**
- 👤 **Lihat profil** (kehadiran & cuti)

---

## 🧑‍💼 Tutorial untuk Kepala Divisi (HOD) & Manajer

Sama seperti karyawan, tapi kamu juga bisa:
- Menerima **notifikasi alert** divisi kamu (HIGH/CRITICAL)
- Bertanya ke **Hermez AI** tentang data divisi kamu

---

## 🔧 Cara Manual (jika tombol tidak tersedia)

Jika halaman Telegram tidak muncul atau tombol tidak berfungsi, kamu bisa menghubungkan secara manual:

1. Login ke aplikasi divisi → buka menu Telegram → dapatkan kode 6 karakter
2. Buka Telegram → cari bot **@ykp_hermez_bot**
3. Ketik: `/link KODE` (ganti KODE dengan kode kamu, contoh: `/link ABC234`)
4. Bot akan mengonfirmasi koneksi

---

## ❓ Pertanyaan Umum (FAQ)

### Apakah saya perlu menghubungkan di setiap divisi?
**Tidak.** Satu koneksi cukup untuk semua divisi karena memakai bot yang sama.

### Kode saya kedaluwarsa, bagaimana?
Kode berlaku 10 menit. Jika kedaluwarsa, tap **"Buat kode baru"** di halaman Telegram.

### Saya tidak punya akun aplikasi divisi, bagaimana?
Hubungi admin HR/divisi kamu untuk dibuatkan akun.

### Saya sudah terhubung tapi tidak bisa absen?
Pastikan akun kamu sudah terhubung ke data karyawan (employee_id). Hubungi admin HR jika belum.

### Bagaimana cara memutus koneksi?
Hubungi admin untuk memutus koneksi Telegram dari akun kamu.

---

## 🛠️ Untuk Admin / Developer

### Prasyarat
- `TELEGRAM_BOT_SECRET` di-set (sama) di **semua app** + hermez
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` di-set di **setiap app** (mis. `ykp_hermez_bot`) agar deep-link benar
- User punya `employee_id` di tab `users` (untuk absen/jadwal/cuti)

### Endpoint yang dipakai
- `POST /api/<divisi>/telegram/link` — buat kode (session)
- `POST /api/<divisi>/telegram/link/consume` — bind chat_id (bot, x-bot-secret)
- Deep-link: `https://t.me/<bot>?start=<KODE>` → bot auto-connect

### Alur teknis
1. Staf login → halaman Telegram → `POST /link` → dapat kode
2. Staf tap "Buka Telegram" → `t.me/<bot>?start=KODE`
3. Bot terima `/start KODE` → `POST /link/consume` → bind `chat_id ↔ user_id`
4. Bot tampilkan menu tombol
