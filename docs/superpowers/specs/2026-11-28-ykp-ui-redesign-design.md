# YKP UI Redesign — Sesuai Referensi Rizal

- **Tanggal:** 2026-11-28
- **Status:** Design approved (menunggu review spec tertulis)
- **Pemilik:** Tim YKP (Om Leo) · Referensi desain: Rizal
- **Pendekatan:** A — "Token-first re-theme + app Marketing baru"
- **Urutan:** M0 Fondasi → M1 Hub → M2 Operasional → M3 Marketing → M4 App lain

---

## 1. Tujuan

Menyamakan tampilan seluruh sistem YKP dengan referensi UI dari Rizal, **tanpa merusak program yang sudah berjalan**.

Target hasil:
- Identitas visual konsisten: **merah `#E01020` + ink `#101010` + putih**, di semua permukaan.
- **Hub**: login bergaya "Google → PIN" (arsitektur disiapkan, di balik feature-flag) + modul tampil sesuai peran.
- **Operasional**: checklist Opening/Closing terpisah per divisi (Kasir/Bar-Helper/Kitchen), konsep "Draf SOP".
- **Marketing**: modul baru (app terpisah) menampilkan Panduan Meta + Arahan Konten ber-provenance, responsif.

## 2. Non-goals (out of scope)

- Aktivasi Google OAuth + PIN sungguhan (butuh kredensial GCP OAuth client & domain). Hanya **scaffold** + UI, flag default OFF.
- 7 sub-halaman Marketing lain (Ngobrol Konten, Content Planner, Tugas, Publikasi, Performa & Hasil, Pengaturan, Log Aktivitas) dan backend Sheets Marketing.
- Integrasi publikasi/performa Meta, scraping/verifikasi tren.
- Migrasi data apa pun, perubahan kontrak API/DB, perubahan infra, dependency baru.

## 3. Guardrail non-breaking (WAJIB)

1. App yang sudah ada: hanya **lapisan token/visual**. Tidak menyentuh backend Sheets, kontrak `{data}`/`{error}`, `ykp_hub_session`, SSO, struktur data, atau env.
2. Tidak menambah dependency di app lama. Marketing memakai stack yang sudah umum di repo (Next + Tailwind); data **seed lokal**, bukan dependensi baru.
3. Feature-flag `YKP_AUTH_GOOGLE_ENABLED` **default OFF**; alur username/password tetap berfungsi persis seperti sekarang.
4. Setiap app wajib **lint + build (+test) hijau** sebelum lanjut ke app berikutnya.
5. Tidak ada penghapusan file/komponen yang belum tentu tak terpakai; ubah bertahap.

## 4. Design System (fondasi)

### 4.1 Token (`brand.css`, disalin per app)
```css
:root {
  /* brand */
  --brand: 355 85% 47%;        /* ≈ #E01020 */
  --brand-fg: 0 0% 100%;
  --brand-strong: 354 92% 36%; /* hover/aktif */
  --brand-soft: 356 90% 96%;   /* latar lembut */

  /* ink / surface */
  --ink: 0 0% 6%;              /* ≈ #101010 */
  --bg: 0 0% 97%;
  --bg-elevated: 0 0% 100%;
  --fg: 0 0% 8%;
  --fg-muted: 0 0% 40%;
  --border: 0 0% 90%;

  /* status (tetap) */
  --success: 158 64% 40%;
  --warning: 38 92% 50%;
  --danger: 0 72% 51%;
  --info: 217 91% 60%;
  --radius: 0.75rem;
}
```
- Light sebagai default; hero login memakai latar `--brand`, kartu memakai `--ink`/putih.
- Tailwind extend: `colors.brand`, `colors.ink`, `colors.brand-soft`, dst.
- Remap token lama: Hub `--blue*` → `--brand*`; Ops `primary` → `brand` (`destructive` tetap untuk error).

### 4.2 Primitives (per-app lokal, kecil)
`Button` (primary=brand, ghost, outline), `Card`, `Badge` (pill: brand/ink/muted), `Input`, `Tabs`, `AppShell`, `Sidebar`, `BrandSwitcher`, `SectionHeader`.
Tidak membuat paket bersama (lihat Pendekatan A). Salin konsisten antar app.

## 5. Sub-proyek M1 — Hub (`ykp-hub`, port 3000)

### 5.1 Login (reskin sesuai `01 / YKP Hub`)
- Layout dua kolom: **hero merah** (kiri) `SATU AKUN UNTUK RUANG KERJA YKP` / `ORKESTRASI SISTEM · RUANG KERJA YKP`; **kartu gelap** (kanan) dengan langkah `01 Akun Google`.
- Teks acuan: *"Coba alur masuk melalui Google, lalu konfirmasi dengan PIN untuk membuka modul sesuai peran."* Tombol `Simulasikan login Google ›`.
- Fallback: form username/password **tetap ada** saat flag OFF (di-styling brand). Tetap memanggil `POST /api/auth/login` yang sudah ada.

### 5.2 Auth scaffold (flag `YKP_AUTH_GOOGLE_ENABLED`, default OFF)
- `POST /api/auth/google`: bila flag OFF → `{ error: { code: "disabled" } }` HTTP 501. Bila ON (future): verifikasi Google ID token → map email → user → terbitkan cookie hub yang sama.
- `POST /api/auth/pin`: bila flag OFF → 501. Bila ON: verifikasi PIN sebagai faktor kedua.
- **Tidak mengubah** `/api/auth/login`, `/api/auth/me`, `logout`, nama/format cookie.

### 5.3 Dashboard (reskin)
- Token merah-hitam; kartu modul aksen brand (boleh variasi ikon, warna tetap dalam keluarga brand).
- **Visibilitas modul sesuai peran**: map role→modul; default semua terlihat bila tak terdefinisi. Tidak mengubah mekanisme SSO (`ssoUrl`).
- Tambah **Marketing** sebagai modul ke-7 (additive di `HUB_MODULES` + `PRESENTATION`) — **ditunda ke M3** dengan pola **URL opsional** (modul tanpa URL difilter), agar tidak menambah env build-time wajib yang memutus build existing (lihat guardrail §3).

### 5.4 Acceptance
- Login menampilkan hero merah + kartu `01 Akun Google`; username/password tetap sukses login.
- Flag OFF: `/api/auth/google` & `/api/auth/pin` balas 501 terstruktur; flag ON tidak memecah build.
- `next lint` + `next build` hijau; node-check scripts tetap lulus.

## 6. Sub-proyek M2 — Operasional (`ykp-ops-v1`, port 3007)

### 6.1 Shell
- Header `OPERASIONAL / CHECKLIST DIVISI` + badge `Preview - Draf SOP`; sidebar/topbar bertema brand.

### 6.2 Opening & Closing (sesuai `03 / Operasional`)
- Header filter: `Brand · Outlet · Tanggal` (pakai `outlets`/`shifts` yang sudah dimuat).
- Banner `Draf untuk <brand> - <outlet>` + disclaimer: *"Daftar ini memakai contoh tugas yang disampaikan tim. SOP resmi tiap brand/outlet belum dilampirkan; sesuaikan dan validasi sebelum dipakai operasional."*
- **Tabs per divisi** (Kasir / Bar-Helper / Kitchen) — grouping by `department` dari data existing.
- Item + status pill (`Belum dimulai` / `DONE`), `PIC checklist` + tombol `Mulai checklist`, dan `Riwayat lama tanpa divisi (N)`.
- Opening contoh item: cek & catat saldo kas awal; uji POS/printer/kanal pembayaran; cocokkan menu aktif & promo.
- Closing contoh item: rekonsiliasi kas dengan POS; catat selisih kas & serah terima; simpan bukti & tutup sesi.
- **Reuse** `OpeningClient`/`ClosingClient` + data Sheets; tidak ada perubahan API/data.

### 6.3 Acceptance
- Opening & Closing tampil terpisah, ter-group per divisi, dengan filter & banner draf.
- Logika submit/riwayat tetap; `oxlint` + `vitest run` + `next build` hijau.

## 7. Sub-proyek M3 — Marketing (app baru `ykp-marketing-v1`, port 3009)

### 7.1 Struktur
- Next + Tailwind, token brand sama, **read-only**, data seed lokal `src/data/marketing-preview.ts`.
- Sidebar 9 item (2 aktif: Dashboard, Arahan Konten; sisanya badge "segera"). Header `Kembali ke Hub`, `Ganti aplikasi`, breadcrumb.
- Brand switcher: `Funkydak · Sekar Pizza · Suburbuns · Laju Kopi · Uncle Masala`.
- Org footer: `PT YKP Global Utama — Ruang kerja tim YKP`.

### 7.2 Halaman `/marketing` (Dashboard)
- **Panduan Meta** (atas) + **Arahan Konten** (bawah) di **halaman & scroll yang sama**; mobile: Arahan Konten setelah scroll.
- Panduan Meta: badge `Ada perubahan`, `Refresh panduan`; checklist dasar (mis. "Tinjau panduan akun — Panduan resmi Meta", "Frekuensi posting — target internal (usulan)"); disclaimer **"Tujuan: memperbesar peluang jangkauan dan traffic. Hasil FYP tidak dijanjikan."**

### 7.3 Kartu Arahan Konten (provenance)
- Tiap kartu: kategori (Pizza/Burger), brand, judul arah, ringkasan, sumber, `Posting asli: <tanggal>`, `Performa terkini: belum tersedia`, `Metadata dicek: <tanggal>`, badge `Referensi nyata — bukti terbatas`, disclaimer *"Tautan asli ditemukan, tetapi tren terkini belum bisa diverifikasi. Tidak ada klaim akses ke seluruh FYP."*, aksi `Lihat arahan & bedah` / `Posting asli`.
- Semua diberi label `PREVIEW LOKAL` / `simulasi`.

### 7.4 Data model (seed)
```ts
type Brand = 'Funkydak'|'Sekar Pizza'|'Suburbuns'|'Laju Kopi'|'Uncle Masala';
interface MetaGuideItem { id: string; title: string; source: 'Panduan resmi Meta'; body: string; version: string; done: boolean; }
interface ContentReference {
  id: string; category: 'PIZZA'|'BURGER'|string; brand: Brand;
  heading: string; summary: string; sourceName: string;
  originalPostDate: string; metadataCheckedAt: string;
  performance: 'belum tersedia'|string; evidence: 'bukti terbatas';
}
```

### 7.5 Acceptance
- `/marketing` menampilkan Panduan Meta + Arahan Konten pada satu scroll (desktop), responsif HP.
- Kartu memuat provenance + disclaimer; `vitest run` + `oxlint` + `next build` hijau.

## 8. Sub-proyek M4 — App lain (reskin saja)
- `ykp-owner-v1`, `ykp-hr-v1`, `ykp-finance-v1`, `ykp-warehouse-v1`, `ykp-investor-v1`.
- Import `brand.css`; remap aksen primer → brand di level token/config; **status colors tetap**; audit warna hardcoded, ubah aksen primer saja.
- Tidak ada perubahan fitur/API/data.
- Acceptance per app: `oxlint` + `vitest run` (bila ada) + `next build` hijau.

## 9. Alur data & error handling
- App lama: tidak ada perubahan backend; envelope `{data}`/`{error}` dipertahankan.
- Marketing: data seed statis berlabel preview; integrasi Sheets = follow-up di luar scope.
- Error visual (empty/loading/error state) mengikuti primitives brand; tidak mengubah handler.

## 10. Verifikasi
| App | Lint | Test | Build |
|---|---|---|---|
| hub | `next lint` | node-check scripts | `next build` |
| ops | `oxlint` | `vitest run` | `next build` |
| marketing (baru) | `oxlint` | `vitest run` | `next build` |
| owner/hr/finance/warehouse/investor | `oxlint` | `vitest run` (bila ada) | `next build` |

- Fidelity visual: diserahkan ke **sign-off manual user** (agent tidak dapat melihat render gambar). Agent menyediakan screenshot via Playwright + verifikasi warna terukur `#E01020`/`#101010`.

## 11. Risiko & mitigasi
- **Regresi visual tak sengaja** → perubahan token-first, verifikasi per app, tidak menghapus komponen.
- **Hardcoded color** di app lama → audit grep `blue|indigo|emerald|purple|amber|orange` lalu remap hanya aksen primer.
- **Auth berubah tak sengaja** → flag OFF default; route lama tidak disentuh; test login existing.
- **Scope creep Marketing** → batasi 2 view; 7 lainnya out of scope.

## 12. Acceptance global
- Semua 7 app + Marketing tampil dengan identitas merah-hitam konsisten.
- 3 layar referensi (Hub login, Marketing, Operasional) terpenuhi sesuai §5–§7.
- Tidak ada regresi: seluruh lint/build/test app terdampak hijau.
- Tidak ada perubahan kontrak data/API pada app lama.

## 13. Pertanyaan terbuka
Tidak ada (scoping & pendekatan sudah dikonfirmasi: semua 7 app + 3 layar referensi; auth reskin + scaffold flag; Marketing 2 view).
