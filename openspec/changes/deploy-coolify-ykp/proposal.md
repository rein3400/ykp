## Why

Seluruh keluarga YKP (hub, owner, hr-v1, finance-v1, warehouse, investor, ops, erp hr/finance/hermez, hermez-bot) perlu tayang di satu Coolify project "YKP" agar pilot bisa jalan di infrastruktur milik sendiri, lepas dari Railway/Vercel trial. Arah ini sudah dimulai (8 commit `ci(coolify)` terakhir) tapi belum lengkap: 3 service belum punya Dockerfile, ada tabrakan port 3002/3003, dan env produksi tersebar.

## What Changes

- **Tambah 3 Dockerfile**: `ykp-finance-v1/Dockerfile` (tiru pola `ykp-ops-v1/Dockerfile` yang sudah handle build-time mock), `ykp-owner-v1/Dockerfile` (Next 16 standalone :3010), `ykp-hermez/Dockerfile` (tsc + `node dist/index.js` worker bot).
- **Perbaiki Hub untuk Coolify**: ganti `next.config.mjs` rewrites `localhost:*` ke service-name internal Coolify (atau hapus bila tak terpakai — hub kini membuka modul via `window.open` SSO), dan ganti fallback IP lama `187.52.124.40` di `app/config.ts` ke host baru via `NEXT_PUBLIC_YKP_*_URL` build args.
- **Putuskan collision 3002/3003**: V1-Sheets ATAU ERP-Postgres per port, atau expose via domain berbeda di Coolify. Rekomendasi awal: V1-Sheets (data finance live sudah ada di `ykp-finance-v1/.env`).
- **Rapikan `clients.ts`**: ganti `sed`-patch di `Dockerfile.coolify.*` dengan penanganan `YKP_DB_PLAIN_TCP` langsung di `packages/schema/src/db/clients.ts` (upgrade path yang sudah ditandai `ponytail:` di Dockerfile).
- **Checklist env per service**: pindahkan 15 nilai dari `ykp-finance-v1/.env` lokal + definisikan secret tiap service (SESSION_SECRET unik per app, TELEGRAM_BOT_SECRET bersama, CRON_SECRET per modul, MOKA_* ).
- **Urutan deploy**: Postgres → modul tulis (hr, finance, warehouse, ops) → aggregator (owner, hub, investor) → background (erp-hermez bot, hermez-bot LLM, cron) → smoke test.
- Non-goal: tidak mengubah perilaku aplikasi, tidak memasukkan data produksi asli baru, tidak menyentuh `orchestrator/` (paused).

## Capabilities

### New Capabilities

- `deploy/coolify-ykp`: definisi deployment keseluruhan keluarga YKP di Coolify — daftar service, build context, port, env per service, urutan deploy, dan smoke test.

### Modified Capabilities

- Tidak ada — tidak ada requirement perilaku aplikasi yang berubah.

> Catatan validasi: change ini tooling/infra murni (Dockerfile + config + checklist), sehingga `.openspec.yaml` ditandai `skip_specs: true` dan capability di atas didokumentasikan sebagai `design.md` + `tasks.md`, bukan delta spec perilaku.

## Impact

- File terdampak: 3 Dockerfile baru, `ykp-hub/next.config.mjs`, `ykp-hub/app/config.ts`, `ykp-erp/packages/schema/src/db/clients.ts`, 3 `Dockerfile.coolify.*` (hapus sed-patch), `.env.example` tiap service bila ada var baru.
- Sistem: 1 Coolify project "YKP" (±11 service + 1 Postgres managed), repo `rein3400/ykp` branch `main` sebagai sumber deploy.
- Risiko utama: `NEXT_PUBLIC_*` ter-bake saat build (salah URL = rebuild), tabrakan port 3002/3003 bila dua keluarga aktif bersamaan, kredensial Sheets/Moka harus diinput manual di dashboard Coolify (tidak ikut git).
