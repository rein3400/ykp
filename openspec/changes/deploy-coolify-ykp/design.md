## Context

Lihat `proposal.md` (Why) untuk motivasi. Keadaan saat ini (hasil eksplorasi 2026-09-23):

- 11 deployable dalam 1 repo `rein3400/ykp @ main (992a1dd)`; 8 commit terakhir `ci(coolify)` hanya menyentuh `ykp-erp/Dockerfile.coolify.{hr,finance,hermez}` dengan build context = repo root.
- Dockerfile V1 (`ykp-{hr,warehouse,ops,investor}-v1/Dockerfile`, `ykp-hub/Dockerfile`) memakai build context = subdirektori masing-masing.
- `ykp-hub/next.config.mjs` rewrites menunjuk `localhost:3002/3003/3004/3008`; `ykp-hub/app/config.ts` fallback ke `http://187.52.124.40` (VPS lama).
- `ykp-erp/packages/schema/src/db/clients.ts:60-65` memutuskan SSL dari hostname (`isLocal`); Dockerfile coolify menambal via `sed` dengan flag `YKP_DB_PLAIN_TCP`.
- Satu-satunya `.env` real lokal: `ykp-finance-v1/.env` (15 var terisi, gitignored). Service lain tanpa `.env` → di Coolify semua env diinput manual.
- `NEXT_PUBLIC_*` ter-bake saat `next build` (Dockerfile hub sudah pakai pola `ARG→ENV`; V1 belum).

## Goals / Non-Goals

**Goals:**

- Semua 11 service + Postgres jalan di 1 Coolify project "YKP" dengan build reproducible dari `main`.
- Tidak ada URL `localhost` atau IP lama yang tersisa di artefak build.
- `sed`-patch hilang; `clients.ts` memahami `YKP_DB_PLAIN_TCP` secara native.

**Non-Goals:**

- Tidak mengubah skema DB, logika aplikasi, atau kredensial; tidak migrasi data; tidak menyentuh `orchestrator/`.

## Decisions

1. **Satu Coolify service per deployable, bukan monolit.**
   Rasional: port collision 3002/3003 (V1 vs ERP) tidak bisa diselesaikan dalam 1 container; isolasi restart per modul dipertahankan seperti di Railway.
   Alternatif ditolak: gabung per Model C (`DEPLOYMENT_MODELS.md`) — refactor besar, menunda deploy.

2. **Keputusan collision 3002/3003: V1-Sheets yang tayang; ERP-Postgres non-publik (internal) dulu.**
   Rasional: satu-satunya data live yang terverifikasi ada (`ykp-finance-v1/.env` berisi kredensial Sheets+Moka finance) milik keluarga V1; ERP masih mock ~5.000 record. ERP tetap di-deploy (untuk migrasi bertahap) tapi tanpa domain publik sampai data asli masuk.
   Alternatif: dua-duanya publik via domain beda — ditolak untuk sekarang agar Hub tidak ambigu memilih sumber summary.

3. **Build context mengikuti Dockerfile yang ada.**
   V1 + hub: base_directory = subdirektori. ERP coolify: base_directory = repo root (sesuai komentar `NOTE:` di Dockerfile). Tidak diseragamkan agar diff minimal.

4. **Dockerfile baru meniru `ykp-ops-v1/Dockerfile`.**
   Pola `ENV USE_MOCK_DB=true` + `SESSION_SECRET` placeholder saat build memungkinkan `next build` lolos tanpa kredensial Sheets; runtime memakai env asli Coolify. Berlaku untuk finance-v1 dan owner-v1.

5. **`ykp-hermez/Dockerfile`: image `node:22-slim`, `npm ci → tsc → node dist/index.js`.**
   Rasional: paket ini bukan Next.js (tanpa `.next`), hanya worker long-poll Telegram + LLM Ollama Cloud. Restart policy `unless-stopped`; bukan bagian dari web routing.

6. **Hub: hapus blok `rewrites()` seluruhnya, tanpa fallback.**
   Terverifikasi 2026-09-23 (audit grep): tidak ada konsumen path relatif `/finance/*`, `/hr-prod/*`, `/hermez/*`, `/hr-v1/*` di kode aktif. Semua navigasi absolut via `ssoUrl()` (`page.tsx`, `dashboard.tsx`, `module-card.tsx`, `module-view.tsx` iframe+new-tab); `fetch("/api/...")` hanya untuk API milik hub sendiri; login proxy + health probe memakai URL absolut dari `app/config`. Satu-satunya hit `/api/hermez/brief` ada di file log `2026-07-19-091733-f.txt`, bukan kode.
   Catatan: komentar `apps.ts:102-103` (finance/owner = ERP SSO bridge) adalah dokumentasi era Railway yang basi — aktual `ROLE_SSO_APPS = {"ops"}` saja. Selaraskan komentar saat eksekusi.

7. **`clients.ts` membaca `YKP_DB_PLAIN_TCP=true` → `ssl: false`.**
   Menggantikan `sed`-patch di 3 Dockerfile coolify (baris `sed` dihapus). Perilaku default tidak berubah (non-local tetap `require`), sehingga Railway/Supabase tidak terpengaruh.

8. **Env strategy: manual input di dashboard Coolify, dikelompokkan 4 lapis + 2 koreksi audit 2026-09-23.**
   Finance 3-mode: Sheets primer, Postgres mirror (`USE_POSTGRES`+`DATABASE_URL`), mock fallback — deploy membawa ketiganya; Moka live sync AKTIF (`MOKA_SYNC_ENABLED=true`, 3 outlet, cron GitHub 16:00 UTC diarahkan ke URL Coolify baru).
   Frame policy: hr/warehouse/investor memakai `frame-ancestors 'self' ${YKP_HUB_ORIGIN}` dengan default IP lama — wajib set `YKP_HUB_ORIGIN` ke domain hub baru saat build agar embed hub tidak diblokir browser.
   Build-time (`NEXT_PUBLIC_*`, wajib saat build/rebuild), koneksi data (`GOOGLE_*`, `YKP_*_SPREADSHEET_ID`, `YKP_*_DATABASE_URL`, `YKP_DB_PLAIN_TCP`), secret bersama (`TELEGRAM_BOT_SECRET` identik di finance+warehouse+owner; `ERP_SSO_SECRET` identik di erp*+hub), secret per-modul (`SESSION_SECRET` unik per app, `CRON_SECRET`, `MOKA_*`).

## Risks / Trade-offs

- [Risk] `NEXT_PUBLIC_*` salah → hub mengarah ke host lama; butuh rebuild, bukan restart → Mitigasi: kunci daftar URL di tasks; verifikasi via `grep` bundle atau halaman hub setelah deploy.
- [Risk] `sed`-pattern basi bila `clients.ts` berubah sebelum Decision 7 mendarat → build ERP pecah samar → Mitigasi: kerjakan Decision 7 duluan, hapus baris `sed` dalam change yang sama.
- [Risk] `.env` finance lokal tidak ikut git; nilai Moka/Sheets bisa tidak terpindah lengkap → Mitigasi: checklist var-per-service di tasks (nama saja); operator centang per var di dashboard Coolify.
- [Risk] Owner auto-fallback mock menutupi modul yang mati (dashboard tetap render) → Mitigasi: smoke test memaksa `YKP_OWNER_MOCK=false` + matikan satu modul? Tidak — cukup: assert probe `/api/*/summary` tiap modul 200 sebelum nyatakan owner "live".
- [Risk] Dua change in-progress (`moka-live-sync` 19/27) ikut ter-deploy setengah jadi → Mitigasi: aman by default (`MOKA_SYNC_ENABLED=false`); sync tidak diaktifkan di Phase deploy ini.
- [Trade-off] 11 service = 11 build Next.js (±lambat di VPS kecil) → diterima; build bisa antri per phase.

## Migration Plan

```
Phase 0 — Persiapan (lokal): 3 Dockerfile baru + clients.ts + hapus sed + hapus rewrites hub.
         Verifikasi lokal: tsc/vitest per app yang tersentuh; `docker build` kering bila memungkinkan.
Phase 1 — Coolify: buat project "YKP", Postgres managed, catat internal hostname.
         Deploy erp-hr/finance/hermez (internal, tanpa domain publik) + `db:migrate`.
Phase 2 — Deploy modul tulis V1: hr, finance, warehouse, ops (domain publik, env Sheets).
         Bootstrap Sheets bila kosong; seed-user untuk owner awal; ROTATE owner123.
Phase 3 — Deploy aggregator: owner (YKP_*_URL → domain Phase 2), hub
         (NEXT_PUBLIC_* build args → domain final), investor.
Phase 4 — Background: hermez-bot (token+LLM), cron eksternal memanggil
         daily-brief + Moka sync? TIDAK (tetap false) — cron hanya summary/brief.
Phase 5 — Smoke: /login tiap service + /api/*/summary + hub health probe hijau semua.
Rollback: setiap service independen — rollback = redeploy tag/commit sebelumnya
         per service di dashboard Coolify; Postgres tidak di-rollback (migrate forward-only,
         advisory-locked). Mock fallback V1 membuat rollback aman (app tetap render).
```

## Open Questions

- Domain publik final per service (nipio/subdomain sendiri?) — bisa diputuskan saat eksekusi Phase 2 tanpa mengubah desain.
- Apakah `ykp-erp/apps/hermez` (port 3004) perlu domain publik, atau cukup internal untuk cron/run? — default desain: internal dulu.
