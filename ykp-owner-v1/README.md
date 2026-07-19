# YKP Owner Command (`ykp-owner-v1`)

Dashboard komando owner untuk keluarga YKP ERP — **satu layar dengan visibilitas penuh**
lintas modul, di-review dari HP (mobile-first, Bahasa Indonesia).

## Apa ini

Next.js 16 (App Router), port **3010**. Lapisan **agregasi read-only**: memanggil
PUBLIC summary API milik aplikasi sibling dan menormalisasinya menjadi satu
`OwnerOverview`. Deep-link keluar ke aplikasi modul untuk semua aksi.

## Doktrin read-only (Hermez no-write-back)

Dashboard ini **tidak pernah menulis ke modul manapun**. Tidak ada ACK alert,
tidak ada approve action, tidak ada input operasional. Setiap alert/action
ditangani di modul pemiliknya melalui tombol deep-link (`Tangani ↗`).

## Modul & kontrak publik

| Modul | Env var | Port | Endpoint publik |
|---|---|---|---|
| Keuangan | `YKP_FINANCE_URL` | 3003 | `GET /api/finance/summary`, `/summary/count` |
| SDM | `YKP_HR_URL` | 3002 | `GET /api/hr/summary?date=`, `/summary/count` |
| Gudang | `YKP_WAREHOUSE_URL` | 3005 | `GET /api/warehouse/summary`, `/summary/count`, `/alerts`, `/actions`, `/purchase-recommendation` |
| Operasional | `YKP_OPS_URL` | 3007 | `GET /api/ops/summary`, `/summary/count` |
| Investor | `YKP_INVESTOR_URL` | 3006 | `GET /api/investor/summary` |

Semua fetch server-side dengan timeout ≤ 4 detik dan isolasi kegagalan per modul:
modul mati → tile-nya OFFLINE, sisanya tetap render.

## Setup

```bash
cp .env.example .env
npm.cmd install
npm.cmd run dev    # http://localhost:3010
```

`.env`:

- `YKP_HR_URL` / `YKP_FINANCE_URL` / `YKP_WAREHOUSE_URL` / `YKP_OPS_URL` / `YKP_INVESTOR_URL` — base URL tiap modul
- `SESSION_SECRET` — secret HS256 untuk cookie `ykp_owner_session` (≥ 32 chars)
- `YKP_OWNER_MOCK` — `true` untuk mode demo offline

## Mode MOCK

Aktif saat `YKP_OWNER_MOCK=true` **atau** semua modul tidak bisa dihubungi.
Dashboard menampilkan dataset demo bawaan yang kaya: 5 brand (Funkydak,
Sekarpizza, Suburbuns, Laju Kopi, Uncle Masala), 7 outlet, KPI realistis,
alert lintas severity (CRITICAL→LOW), action dengan PIC/deadline.
Login demo lokal: **owner / owner123** (banner peringatan tampil di UI).
Header menampilkan badge **MOCK** yang jelas.

## Auth (HR-as-IdP)

`POST /api/auth/login` meneruskan kredensial ke `${YKP_HR_URL}/api/auth/login`;
saat sukses, dashboard mencetak cookie HS256 sendiri `ykp_owner_session`
(24 jam, httpOnly, sameSite strict). Role yang boleh masuk: `owner`,
`super_admin`, `viewer` (semua read-only di sini). Middleware ada di
`src/middleware.ts` (wajib di dalam `src/` untuk Next 16 Turbopack).

## Halaman

- `/owner` — command home: tile modul, headline strip (Estimasi Surplus Kas,
  revenue vs rata-rata 7 hari, staf hadir/telat, stok kritis, insiden HIGH/CRITICAL),
  alert inbox lintas modul, action tracker OPEN/OVERDUE
- `/owner/keuangan` — KPI konsolidasi + filter brand/outlet + deep link
- `/owner/sdm` — kehadiran/telat/absen/cuti per outlet, shift shortage, payroll
- `/owner/gudang` — nilai inventori, stok kritis, varians, expiry, purchase recs
- `/owner/operasional` — kesiapan outlet, checklist, insiden, selisih kas
- `/owner/investor` — portfolio, dividen, performa per brand
- `/owner/brief` — Daily Brief format Hermez + copy-to-clipboard (tanpa Telegram)
- `/owner/health` — ping ms, record count, tanggal summary terakhir per modul
- `/login`

## Deep-link map

| Dari owner app | Ke modul |
|---|---|
| Alert inbox → Tangani | `{base}/finance/alerts`, `{base}/warehouse/alerts`, `{base}/ops/incidents`, `{base}/hr/attendance` |
| Action tracker → Buka | `{base}/finance/actions`, `{base}/warehouse/actions`, `{base}/ops/actions` |
| Keuangan detail | `{base}/finance/pos`, `/suppliers`, `/summary` |
| SDM detail | `{base}/hr/payroll`, `/attendance`, `/lateness` |
| Gudang detail | `{base}/warehouse/stok`, `/expiry`, `/opname`, `/purchase-recommendation` |
| Operasional detail | `{base}/ops/incidents`, `/opening`, `/closing`, `/actions` |
| Investor detail | `{base}/investor/portfolio`, `/dividend`, `/returns` |

## Arsitektur

- `src/lib/aggregate.ts` — fetch paralel semua modul, normalisasi ke `OwnerOverview`
- `src/lib/status.ts` / `alerts.ts` / `brief.ts` / `consolidate.ts` — fungsi murni
  (status tile, merge/sort alert, komposisi brief Hermez, konsolidasi KPI) — dites vitest
- `src/lib/mock.ts` — dataset demo bawaan
- Halaman = server components yang memanggil aggregate lib; komponen client minimal
  (filter, copy button, logout)

## Quality gates

```bash
npm.cmd test        # vitest — logika agregasi/status/brief
npm.cmd run build   # next build
npm.cmd run lint    # oxlint
```
