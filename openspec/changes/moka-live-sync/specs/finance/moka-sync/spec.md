# Spec Delta: finance/moka-sync

## Purpose

Mendefinisikan perilaku ingest otomatis data penjualan Moka POS via Open API ke tab Sheets finance, menggantikan alur unggah CSV manual, untuk semua outlet yang terdaftar (awal: Sekar Pizza Tirtodipuran, Funkydak Colombo, Suburbuns Colombo).

## ADDED Requirements

### Requirement: Konfigurasi kredensial per outlet
Sistem MUST membaca kredensial Moka (client ID + client secret) per outlet dari environment variables, satu pasangan per outlet terdaftar. Sistem MUST menolak menjalankan sinkronisasi untuk outlet yang kredensialnya tidak lengkap, dengan pesan error yang menyebut nama outlet. Kredensial MUST NOT pernah ditulis ke Sheets, kode, log, atau audit.

#### Scenario: Outlet tanpa kredensial
- **WHEN** sinkronisasi dijalankan dan salah satu outlet tidak memiliki client ID atau client secret di environment
- **THEN** outlet tersebut dilewati, outlet lain tetap diproses, dan hasil berisi entri error yang menyebut outlet mana yang dikonfigurasi kurang

#### Scenario: Secret tidak bocor
- **WHEN** respons API atau error dikembalikan ke pemanggil maupun ditulis ke audit log
- **THEN** tidak ada client secret, access token, atau refresh token yang muncul di dalamnya

### Requirement: Otorisasi dan penyimpanan token
Sistem MUST menyediakan alur otorisasi sekali-jalankan: menukar kode otorisasi Moka menjadi access token dan refresh token (grant authorization-code, dengan fallback client-credentials bila terbukti didukung), lalu menyimpan refresh token per outlet di tab `app_settings`. Setiap permintaan API yang token-nya kedaluwarsa MUST otomatis di-refresh memakai refresh token sebelum dinyalakan gagal. Jika refresh ditolak Moka, sistem MUST melaporkan outlet butuh otorisasi ulang (bukan mencoba berulang).

#### Scenario: Token kedaluwarsa saat sinkronisasi
- **WHEN** access token outlet sudah tidak valid dan sync berjalan
- **THEN** sistem menukarnya dengan refresh token, memperbarui token tersimpan, dan sinkronisasi berlanjut tanpa intervensi

#### Scenario: Refresh ditolak
- **WHEN** Moka menolak refresh token outlet (mis. dicabut)
- **THEN** sinkronisasi outlet itu berhenti dengan status "perlu otorisasi ulang", outlet lain tetap diproses, dan hasil berisi instruksi otorisasi ulang

### Requirement: Sinkronisasi ringkasan penjualan harian
Sistem MUST mengambil ringkasan penjualan per outlet untuk rentang tanggal yang diminta (default: tanggal operasional terakhir, zona Asia/Jakarta), mengonversi tanggal format Moka `DD/MM/YYYY` ke `YYYY-MM-DD`, dan menulisnya ke tab `fin_pos_daily` dengan source `moka`, uang sebagai integer IDR tanpa desimal.

#### Scenario: Sync satu hari normal
- **WHEN** sinkronisasi dijalankan untuk tanggal operasional terakhir dan Moka mengembalikan data ringkasan
- **THEN** setiap outlet terdaftar menghasilkan satu baris `fin_pos_daily` untuk tanggal tersebut, dengan net sales yang sama dengan angka Moka (integer IDR)

#### Scenario: Tanggal format Moka
- **WHEN** Moka mengembalikan tanggal `04/09/2026`
- **THEN** baris yang ditulis bertanggal `2026-09-04`

### Requirement: Sinkronisasi penjualan per item
Sistem MUST mengambil penjualan per item (`item_sales` v3) untuk rentang tanggal yang sama dan menulisnya ke tab `fin_pos_items` (per outlet, per item, per tanggal), integer IDR.

#### Scenario: Item untuk menu terlaris
- **WHEN** sinkronisasi item selesai untuk sebuah tanggal
- **THEN** Hermez (get_sales_items) dan halaman Owner /penjualan dapat membaca item tersebut dari tab `fin_pos_items` tanpa perubahan kode di sisi mereka

### Requirement: Dedup dan idempotensi
Menjalankan sinkronisasi yang sama dua kali untuk tanggal yang sama MUST NOT menduplikasi baris. Baris yang sudah ada untuk kombinasi (tanggal, outlet) pada `fin_pos_daily` — dan (tanggal, outlet, item) pada `fin_pos_items` — MUST diperbarui nilainya, bukan ditambah baris baru.

#### Scenario: Sync ulang tanggal sama
- **WHEN** sinkronisasi dijalankan dua kali untuk tanggal yang sama tanpa perubahan data di Moka
- **THEN** jumlah baris `fin_pos_daily` dan `fin_pos_items` untuk tanggal tersebut tidak bertambah, dan nilainya tetap benar

### Requirement: Mapping outlet internal
Setiap outlet Moka MUST dipetakan ke outlet internal (`OL-NNN`) sebelum menulis. Outlet Moka yang belum dipetakan MUST dilewati dengan entri error eksplisit (bukan gagal total, bukan ditulis tanpa outlet internal).

#### Scenario: Outlet belum dipetakan
- **WHEN** Moka mengembalikan data untuk outlet yang belum ada di mapping
- **THEN** data outlet itu tidak ditulis, entri error menyebut ID outlet Moka, dan outlet terpetakan lainnya tetap tersinkron

### Requirement: Dedup lintas sumber (CSV)
Baris dari API dengan source `moka` dan baris hasil impor CSV untuk tanggal + outlet yang sama MERUPAKAN data yang sama; sistem MUST mencegah terjadinya dua sumber aktif untuk tanggal yang sama — sinkronisasi API wajib memperbarui baris `source=moka` yang ada, dan penambahan baris CSV manual untuk tanggal yang sudah tersinkron API harus ditolak atau ditandai.

#### Scenario: CSV datang setelah API
- **WHEN** tanggal X sudah tersinkron lewat API, lalu admin mengunggah CSV yang memuat tanggal X
- **THEN** impor CSV menolak atau menandai baris tanggal X sebagai duplikat sumber, dan ringkasan harian tidak menghitung ganda

### Requirement: Penanganan kegagalan dan kuota
Kegagalan satu outlet (API error, timeout, kuota habis) MUST NOT menggagalkan outlet lain. Respons sinkronisasi MUST merangkum per outlet: jumlah baris ditulis/diperbarui, daftar error. Sebelum batch besar, sistem MAY memeriksa sisa kuota (`GET /v1/quotas`) dan berhenti dengan pesan jelas bila tidak cukup.

#### Scenario: Satu outlet error
- **WHEN** outlet B gagal karena API error sementara outlet A dan C berhasil
- **THEN** data A dan C tersimpan, hasil berisi error untuk B, dan sinkronisasi dapat diulang hanya untuk B

### Requirement: Audit dan keterlacakan
Setiap eksekusi sinkronisasi (manual maupun cron) MUST mencatat entri audit: aktor/trigger, tanggal, per-outlet hasil (baris ditulis, diperbarui, error), dan periode data yang ditarik. Sinkronisasi otomatis terjadwal MUST dapat dipicu manual oleh admin (endpoint khusus admin) untuk pemulihan dan pengujian.

#### Scenario: Cron gagal, admin koreksi manual
- **WHEN** sync terjadwal gagal total dan admin memicu endpoint sync manual untuk tanggal mundur
- **THEN** sinkronisasi berjalan untuk tanggal yang diminta dan audit log mencatat pemicu manual beserta hasilnya

### Requirement: Read-only terhadap Moka
Sistem MUST hanya memanggil endpoint baca laporan Moka. Tidak ada pemanggilan endpoint tulis Moka (checkout, advanced orderings, modifikasi item) dari jalur sinkronisasi mana pun.

#### Scenario: Audit permukaan API
- **WHEN** kode sinkronisasi ditinjau atau diuji
- **THEN** hanya endpoint laporan (`sales_summary`, `item_sales`, token, quotas) yang dipanggil terhadap domain Moka