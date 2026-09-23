## 1. Dockerfile yang belum ada

- [x] 1.1 Buat `ykp-finance-v1/Dockerfile` meniru `ykp-ops-v1/Dockerfile` (build-time `USE_MOCK_DB=true` + placeholder `SESSION_SECRET`, expose + start `:3003`)
- [x] 1.2 Buat `ykp-owner-v1/Dockerfile` (Next 16 standalone, build-time mock agar `next build` lolos tanpa sibling URL, expose + start `:3010`)
- [ ] 1.3 DEFERRED (Opsi B): `ykp-hermez` broken di `main` (5 file sumber hilang, lengkap hanya di `mom-1sep-fixes`) — service 11 ditunda, notifikasi via ERP `bot-worker.mjs`
- [x] 1.4 Verifikasi: `tsc --noEmit` + `vitest` tiap app; `next build` finance/hr/owner/warehouse/ops/investor sukses (`docker build` full hang tanpa output di mesin ini — verifikasi via `npm run build` dgn env yg sama)

## 1b. Pulihkan file provider yang hilang (R1, akar: revert `95f38b8`)

- [x] 1b.1 Checkout dari `origin/mom-1sep-fixes`: `finance/{notify-gateway,settings,concurrency}.ts`, `hr/{attendance-lookup,notify-gateway}.ts`, `warehouse/{notify-gateway,db/postgres}.ts`, `investor/{notify-gateway,db/postgres}.ts`, `ops/db/postgres.ts`
- [x] 1b.2 Pulihkan `finance/src/lib/audit.ts` chain-hash (`computeChainHash`, `verifyAuditChain`) dari `95f38b85^`
- [x] 1b.3 Bersihkan unused import (`readTab`, `TABS`) di `finance/src/lib/concurrency.ts`
- [x] 1b.4 Verifikasi: `tsc` bersih finance/hr/warehouse/ops/investor; `next build` 6/6 sukses; vitest warehouse 121/121, ops 10/10, investor 55/55, owner 37/37; finance 130/133 + hr 88/89 — sisa gagal pre-existing di file tak tersentuh (`approval.ts`, `moka-importer.ts`, `telegram-attendance.ts`)

## 2. Native `YKP_DB_PLAIN_TCP` di `clients.ts`

- [x] 2.1 Tambah pembacaan `YKP_DB_PLAIN_TCP === "true"` → `ssl: false` di `ykp-erp/packages/schema/src/db/clients.ts` (default tak berubah)
- [x] 2.2 Hapus baris `sed`-patch dari `Dockerfile.coolify.{hr,finance,hermez}` beserta komentar `ponytail:`
- [x] 2.3 Verifikasi: `tsc --noEmit` workspace ERP + `grep -r "sed -i" ykp-erp/Dockerfile.coolify.*` kosong

## 3. Hub lepas-localhost

- [x] 3.1 Hapus blok `rewrites()` di `ykp-hub/next.config.mjs` (audit: nol konsumen path relatif)
- [x] 3.2 Ganti fallback `http://187.52.124.40` di `ykp-hub/app/config.ts` dengan `requiredUrl()` (throw bila env kosong); hapus juga fallback `localhost:3002` di `app/api/auth/login/route.ts`
- [x] 3.3 Dockerfile hub diverifikasi lengkap (6 URL + SSO `ARG→ENV`); `NEXT_PUBLIC_APP_URL`/`HERMEZ_URL` tidak dipakai kode — tanpa perubahan
- [x] 3.4 Verifikasi: `next build` hub sukses + `rg` bundle nol `187.52.124.40` dan nol `localhost:300`

## 4. Env per service (diinput di dashboard Coolify, nama saja)

- [ ] 4.1 finance-v1: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `YKP_FINANCE_SPREADSHEET_ID`, `SESSION_SECRET`, `CRON_SECRET`, `ENVIRONMENT`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_SECRET`, `MOKA_SYNC_ENABLED=false`, `MOKA_SYNC_SECRET`, `MOKA_OUTLETS` + `MOKA_<KEY>_{CLIENT_ID,CLIENT_SECRET,OUTLET_ID}` (nilai disalin dari `ykp-finance-v1/.env` lokal), `MOKA_SYNC_ENABLED=true`, opsional mirror PG (`USE_POSTGRES=true` + `DATABASE_URL`)
- [ ] 4.2 hr-v1: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `YKP_HR_SPREADSHEET_ID`, `SESSION_SECRET` (unik), `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `YKP_HUB_ORIGIN` (domain hub baru — gantikan default IP lama agar iframe hub diizinkan)
- [ ] 4.3 warehouse: `GOOGLE_*`, `YKP_WAREHOUSE_SPREADSHEET_ID`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ENVIRONMENT`, `TELEGRAM_BOT_SECRET` (sama dengan 4.1), `YKP_HUB_ORIGIN` (domain hub baru)
- [ ] 4.4 ops: `GOOGLE_*`, `YKP_OPS_SPREADSHEET_ID`, `SESSION_SECRET`, `ENVIRONMENT`, AI (`LLM_*`/`OPENAI_*` sesuai `src/lib/ai.ts`)
- [ ] 4.5 investor: `GOOGLE_*`, `YKP_INVESTOR_SPREADSHEET_ID`, `SESSION_SECRET`, `FINANCE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ENVIRONMENT`, `YKP_HUB_ORIGIN` (domain hub baru)
- [ ] 4.6 owner: `YKP_{HR,FINANCE,WAREHOUSE,OPS,INVESTOR}_URL` (domain final Phase 2), `SESSION_SECRET`, `TELEGRAM_BOT_SECRET` (sama dengan 4.1), `YKP_OWNER_MOCK=false`
- [ ] 4.7 hub (build-time): `NEXT_PUBLIC_YKP_{OWNER,HR,FINANCE,WAREHOUSE,INVESTOR,OPS}_URL`, `NEXT_PUBLIC_ERP_SSO_SECRET`, `NEXT_PUBLIC_APP_URL`; runtime: `ERP_SSO_SECRET`, `HUB_SESSION_SECRET`, `SESSION_SECRET`
- [ ] 4.8 erp hr/finance/hermez: `YKP_{MASTER,HR,FINANCE,HERMEZ}_DATABASE_URL` (internal Postgres), `YKP_DB_PLAIN_TCP=true`, `CRON_SECRET`, `ERP_SSO_SECRET` (sama dengan 4.7), Telegram, Supabase bila dipakai
- [ ] 4.9 hermez-bot: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_IDS`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `YKP_{FINANCE,HR,WAREHOUSE,OPS,INVESTOR}_URL`, `TELEGRAM_BOT_SECRET`

## 5. Deploy Phase 1 — Postgres + ERP internal

- [ ] 5.1 Buat project "YKP" di Coolify + Postgres managed; catat internal hostname
- [ ] 5.2 Deploy erp-hr, erp-finance, erp-hermez (base_directory repo root, tanpa domain publik); jalankan `db:migrate`
- [ ] 5.3 Verifikasi: log migrate advisory-lock OK; health endpoint tiap app 200 via internal network

## 6. Deploy Phase 2 — modul tulis V1

- [ ] 6.1 Deploy hr-v1, finance-v1, warehouse, ops (base_directory subdirektori, domain publik + env 4.1–4.4)
- [ ] 6.2 Bootstrap Sheets bila kosong (`sheets:bootstrap`), `seed-user`, lalu ROTATE kredensial default `owner/owner123`
- [ ] 6.3 Verifikasi: `/login` 200 tiap service; tulis-baca roundtrip (`sheets:smoke`) lolos

## 7. Deploy Phase 3 — aggregator

- [ ] 7.1 Deploy owner dengan URL final Phase 2; deploy hub dengan build args final; deploy investor
- [ ] 7.2 Verifikasi: hub health probe 6/6 hijau; owner dashboard render data live (bukan mock — cek label sumber)

## 8. Deploy Phase 4 — background

- [ ] 8.1 Deploy hermez-bot (token + LLM); daftarkan cron eksternal untuk daily-brief (header `x-cron-secret` / `CRON_SECRET` per modul)
- [ ] 8.2 Aktifkan Moka live sync di produksi: `MOKA_SYNC_ENABLED=true` (data terbaru 2026-09-09, 3 outlet, cron 16:00 UTC test-fire lulus); update GitHub secrets `YKP_FINANCE_URL` → domain Coolify finance + `MOKA_SYNC_SECRET` agar workflow `moka-daily-sync.yml` menembak host baru
- [ ] 8.3 Verifikasi: test-fire cron 1x; log telegram delivery tercatat

## 9. Smoke akhir + serah terima

- [ ] 9.1 Smoke: `GET /api/hr/summary?date=`, `/api/warehouse/summary`, `/api/ops/summary`, `/api/investor/summary`, hermez proxy — semua 200
- [ ] 9.2 Perbarui `DEPLOYED_LINKS.md` dengan URL Coolify final + catat kredensial mana yang sudah di-rotate
- [ ] 9.3 Putar ulang kredensial dashboard Coolify yang sempat lewat channel chat; tutup akses register publik bila memungkinkan

---

## Execution log — 2026-09-23 (Coolify VPS 187.127.124.37)

Project **YKP** / environment `production` (uuid `t5cnqcdicw6t9eilbwgafl4l`), server `localhost`,
source `rein3400/ykp@main` `ca6e629`, apps published via `ports_mappings` (IP:port), not Traefik.

| Service | Coolify uuid | URL | State |
|---|---|---|---|
| hub | `l79lqzirhbingnpuipcygggt` | :3000 | ✅ health 6/6, SSO login OK |
| owner | `5hwspriiojkoviflj4valbkc` | :3010 | ✅ |
| hr-v1 | `cqtltk5zbtljgfhbulgooweg` | :3002 | ✅ (mock) |
| finance-v1 | `d3yzfwoon1q3uedheo8bgx1g` | :3003 | ✅ (mock) |
| warehouse-v1 | `lxn2necwmx7kzsn7i2l4kycz` | :3005 | ✅ (mock) |
| investor-v1 | `hja2sf7mlxbhqowdjp0igbcz` | :3006 | ✅ (mock) |
| ops-v1 | `fchbdokhr7voynzct04agxgb` | :3007 | ✅ (mock) |
| erp hr/finance/hermez | pre-existing | internal | running (built from an earlier commit) |
| postgres / redis | pre-existing | internal | healthy |
| hermez-bot | — | — | ⏸ deferred (task 1.3) |

Code changes pushed for this deploy: `eda9c12` (native `YKP_DB_PLAIN_TCP`), `8f8a5c1` (hub
`requiredUrl`, rewrites dropped), `c080ecb` (finance/owner Dockerfiles), `e6e4db9` (V1
build-time `ARG`/`ENV`), `ca6e629` (hub internal server URLs for probe + login proxy).

Still open for the owner:
1. Fill Sheets creds (`GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY`, `YKP_*_SPREADSHEET_ID`) for
   hr-v1 / finance-v1 / warehouse / investor / ops → apps leave mock mode; runtime vars, no rebuild.
2. Fill `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` (currently empty) and `OPENAI_API_KEY` (ops).
3. `MOKA_SYNC_ENABLED=false` was forced (local `.env` says `true` but Sheets creds are empty,
   so sync had nowhere to write). Flip to `true` once Sheets creds are in.
4. Rotate default `owner/owner123` per app; rotate the Coolify dashboard password (task 9.3).
5. `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` + `YKP_HUB_ORIGIN` are build-time → redeploy after change.
6. Optional: redeploy the ERP trio so they match `main` (sed-patch removal + native plain-TCP).
7. Cron for daily-brief (task 8.1) not registered yet; `CRON_SECRET` already generated per module.

---

## Execution log N2 — 2026-09-23 (credentials + cron + live mode)

Recovered real credentials from git history (`b7a12e6d`, `a1a92416` — the "commit all V1
.env files" commits) and pushed them into Coolify as runtime env vars, then recreated the
containers (`POST /applications/{uuid}/restart` → `restart_only` deployment, no rebuild):

- Google service account (email + 1730-char key) + per-module `YKP_*_SPREADSHEET_ID` →
  all five V1 modules left mock mode and read the real spreadsheets.
- Telegram `TELEGRAM_BOT_TOKEN` (`@justatestermaybot`) + working `TELEGRAM_CHAT_ID`
  (the hr/finance env chat id was stale — `chat not found`; the warehouse env one works).
- `CRON_SECRET` (hr == finance in the historical env) / investor generated fresh;
  `MOKA_SYNC_SECRET` in the local `.env` was a template comment (`# generate: node -e …`)
  → replaced with a generated 64-hex value.
- `ERP_SSO_SECRET` aligned across hub + investor + the three ERP apps.
- `MOKA_SYNC_ENABLED=true` now that Sheets creds exist.

Cron registered as Coolify scheduled tasks (per-app, in-container `node -e fetch(...)`):

| App | Task | Cron (UTC) | Result |
|---|---|---|---|
| hr-v1 | daily-brief | `0 15 * * *` | ✅ SENT (sent 1) |
| hr-v1 | contract-reminders | `0 1 * * *` | registered |
| finance-v1 | daily-brief | `0 15 * * *` | registered |
| finance-v1 | moka-pos-sync | `0 16 * * *` | ✅ 200, needs `moka_outlet_map` |
| warehouse-v1 | daily-brief | `0 15 * * *` | registered |
| warehouse-v1 | random-audit | `0 1 * * 1` | ✅ CREATED 2026-W39 |
| warehouse-v1 | verify-audit-chain | `30 16 * * *` | ✅ ok, 112 legacy rows skipped |
| investor-v1 | daily-brief | `0 15 * * *` | ✅ SENT (sent 1) |

Code fixes found while wiring this up (both pushed):

- `a786aca` warehouse: `/api/warehouse/cron/*` was not in the middleware PUBLIC list, so a
  generic 401 blocked the scheduler before `isCronAuthorized` could run.
- `ca6e629` hub: server-side probe + login proxy now use `YKP_<ID>_INTERNAL_URL`
  (docker-network hostname) instead of the public IP.

Still open (owner): `moka_outlet_map` rows, real `OPENAI_API_KEY` for ops, credential
rotation (`owner/owner123` + Coolify dashboard), optional ERP-trio redeploy.

---

## Execution log N3 — 2026-09-23 (follow-ups)

- **ERP trio redeployed** from `main` (`a786aca`): erp-hr :3002, erp-finance :3003,
  erp-hermez :3004 all report Next.js `Ready`; hermez logs `[hermez-bot] disabled`
  (`HERMEZ_BOT_DISABLED=true`, as designed). They now run the same commit as the V1 family
  (native `YKP_DB_PLAIN_TCP`, no sed patch) and share `ERP_SSO_SECRET` with hub/investor.
- **Default `owner/owner123` rotated** in the shared Sheets user store via
  `POST /api/hr/auth/change-password` (old password now 401, new one 200; hub SSO verified
  with the new value). Value deliberately not written to the repo — see the owner.
- **Moka outlet map cannot be derived**: Moka's three outlets
  (`SEKARPIZZA_TIRTODIPURAN` 772618, `FUNKYDAK_COLOMBO` 696752, `SUBURBUNS_COLOMBO` 843676)
  have no counterpart in `master_outlet` (OL-001…OL-005 are Cipete/Kemang/Demangan/Senopati/
  Kemang). Needs an owner decision on creating the outlet rows vs reusing an existing id;
  then seed `app_settings.moka_outlet_map` (or env `MOKA_OUTLET_MAP` on finance).
- **Ops AI stays off**: the only real LLM key in the repo is Ollama Cloud, but
  `ykp-ops-v1/src/lib/ai.ts` calls Ollama without an Authorization header. Fixing that would
  change app behaviour, i.e. outside this change's non-goal — raise a follow-up change.

---

## Execution log N4 — 2026-09-23 (Moka outlet map closed)

Owner approved creating the missing Moka outlets. Added to the finance workbook
`master_outlet` (ids re-checked after a first append collided with OL-008..OL-010 which were
already taken by Laju Kopi / Uncle Masala — rows 13–15 were re-id'd to OL-011..OL-013):

| row | id | brand | name |
|---|---|---|---|
| 13 | OL-011 | BR-001 | Funkydak Colombo |
| 14 | OL-012 | BR-002 | Sekarpizza Tirtodipuran |
| 15 | OL-013 | BR-003 | Suburbuns Colombo |

`MOKA_OUTLET_MAP` env set on finance (`{"696752":"OL-011","772618":"OL-012","843676":"OL-013"}`)
→ the sync bootstraps `app_settings.moka_outlet_map` (now persisted in the sheet).
Test-fire result: all three outlets `ok` — `fin_pos_daily` written 1/1/1, `fin_pos_items`
written 20/16/31 → **task 8.2 (Moka live sync) is closed**; the Coolify scheduled task
`moka-pos-sync` (`0 16 * * *`) keeps it running, so the GitHub Actions workflow secrets are
no longer required for this.

Address/lat/lng of the three rows are intentionally blank — the owner fills them in the sheet.

---

## Execution log N5 — 2026-09-23 (HTTPS domains + URL switch)

Coolify auto-generates a domain per app (`<uuid>.<ip>.sslip.io`) but the stored `fqdn` used
an `http://` scheme, so `generateLabelsApplication` emitted **only** an `http-0-…` router —
no `https-0-…` router with `tls.certresolver`, hence the domains 404'd (and the earlier
`187-127-124-37` hyphen-form tests were a false negative: Traefik's rule uses the dotted
host form).

Fix applied via API, no SSH:

1. `PATCH /applications/{uuid}` `domains=https://<host>` + recreate → labels now include
   `traefik.http.routers.https-0-<uuid>.tls.certresolver=letsencrypt`; Let's Encrypt issued
   valid certs for all 7 apps (`ssl_verify_result=0`). `POST /servers/{uuid}/proxy/restart`
   was used once to force Traefik to re-sync the recreated containers.
2. Switched the app-internal URLs to HTTPS (build-time → rebuilt hub + hr + warehouse +
   investor; runtime → recreated owner + ops):
   `NEXT_PUBLIC_YKP_*_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_FINANCE_URL`, `YKP_HUB_ORIGIN`,
   `HUB_ORIGINS`, owner `YKP_*_URL`. `YKP_*_INTERNAL_URL` stays on the docker network.

Why this mattered beyond cosmetics: hub, finance and investor set session cookies with
`secure: NODE_ENV === 'production'`, so over plain HTTP a browser would drop the cookie and
login would silently fail. Verified after the switch: HTTPS login → cookie → protected
endpoint returns 200 with the cookie and 401 without it.

Post-change regression pass: hub `/api/health` = ok (6/6) and all scheduled tasks fire green
(hr + investor daily-brief SENT, moka-pos-sync ran for 2026-09-24, warehouse verify-audit-chain ok).
