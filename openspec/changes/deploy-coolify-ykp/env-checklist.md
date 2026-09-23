# Env Checklist — Deploy Coolify Project "YKP"

> Cara pakai: di dashboard Coolify, buka tiap service → Environment Variables → centang per baris.
> Kolom "Contoh" hanya FORMAT — bukan nilai asli. Nilai disalin dari sumber di kolom "Sumber".
> Deploy dari `main @ 992a1dd`. ⏱ = build-time (wajib benar SEBELUM build; salah = rebuild).

## Service 1 — `hub` (:3000, base `ykp-hub/`)

| ☐ | Var | Contoh format | Sumber |
|---|---|---|---|
| ☐ | ⏱ `NEXT_PUBLIC_YKP_OWNER_URL` | `https://ykp-owner.<domain>` | Domain service 2 |
| ☐ | ⏱ `NEXT_PUBLIC_YKP_HR_URL` | `https://ykp-hr.<domain>` | Domain service 3 |
| ☐ | ⏱ `NEXT_PUBLIC_YKP_FINANCE_URL` | `https://ykp-finance.<domain>` | Domain service 4 |
| ☐ | ⏱ `NEXT_PUBLIC_YKP_WAREHOUSE_URL` | `https://ykp-wh.<domain>` | Domain service 5 |
| ☐ | ⏱ `NEXT_PUBLIC_YKP_INVESTOR_URL` | `https://ykp-inv.<domain>` | Domain service 6 |
| ☐ | ⏱ `NEXT_PUBLIC_YKP_OPS_URL` | `https://ykp-ops.<domain>` | Domain service 7 |
| ☐ | ⏱ `NEXT_PUBLIC_ERP_SSO_SECRET` | sama dengan `ERP_SSO_SECRET` | Generate baru ≥16 char |
| ☐ | ⏱ `NEXT_PUBLIC_APP_URL` | `https://ykp-hub.<domain>` | Domain service ini |
| ☐ | `ERP_SSO_SECRET` | (sama dengan di atas) | Generate baru ≥16 char |
| ☐ | `HUB_SESSION_SECRET` | 64 hex | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| ☐ | `SESSION_SECRET` | 64 hex (beda tiap app!) | Generate baru |
| ☐ | `PORT` | `3000` | Coolify biasanya auto-inject |

## Service 2 — `owner` (:3010, base `ykp-owner-v1/`)

| ☐ | Var | Contoh format | Sumber |
|---|---|---|---|
| ☐ | `YKP_HR_URL` | `https://ykp-hr.<domain>` (+ `http://localhost:3002` hanya lokal) | Domain service 3 |
| ☐ | `YKP_FINANCE_URL` | `https://ykp-finance.<domain>` | Domain service 4 |
| ☐ | `YKP_WAREHOUSE_URL` | `https://ykp-wh.<domain>` | Domain service 5 |
| ☐ | `YKP_OPS_URL` | `https://ykp-ops.<domain>` | Domain service 7 |
| ☐ | `YKP_INVESTOR_URL` | `https://ykp-inv.<domain>` | Domain service 6 |
| ☐ | `SESSION_SECRET` | 64 hex (unik!) | Generate baru |
| ☐ | `TELEGRAM_BOT_SECRET` | ⚠ SAMA dengan finance/warehouse | Salin dari service 4 |
| ☐ | `YKP_OWNER_MOCK` | `false` | Tetap false di produksi |

## Service 3 — `hr-v1` (:3002, base `ykp-hr-v1/`)

| ☐ | Var | Contoh format | Sumber |
|---|---|---|---|
| ☐ | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `xxx@xxx.iam.gserviceaccount.com` | GCP console (atau kosong → mock) |
| ☐ | `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | GCP JSON key (escape `\n`) |
| ☐ | `YKP_HR_SPREADSHEET_ID` | ID dari URL docs.google.com | Spreadsheet HR |
| ☐ | `SESSION_SECRET` | 64 hex (unik!) | Generate baru |
| ☐ | `CRON_SECRET` | 64 hex | Generate baru |
| ☐ | `TELEGRAM_BOT_TOKEN` | `123456:ABC...` | @BotFather |
| ☐ | `TELEGRAM_CHAT_ID` | `-100123...` (group, negatif) | Telegram group |
| ☐ | `TELEGRAM_WEBHOOK_SECRET` | 64 hex | Generate baru |
| ☐ | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `ykpchataibot` | Tetap |
| ☐ | `YKP_HUB_ORIGIN` | `https://ykp-hub.<domain>` (⏱ build-time!) | Domain service 1 |
| ☐ | `DEFAULT_TZ` | `Asia/Jakarta` | Tetap |

## Service 4 — `finance-v1` (:3003, base `ykp-finance-v1/`)

> Nilai disalin dari `ykp-finance-v1/.env` lokal (15 var terisi).

| ☐ | Var | Contoh format | Sumber |
|---|---|---|---|
| ☐ | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `xxx@xxx.iam.gserviceaccount.com` | Salin dari `.env` lokal |
| ☐ | `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Salin dari `.env` lokal |
| ☐ | `YKP_FINANCE_SPREADSHEET_ID` | ID spreadsheet | Salin dari `.env` lokal |
| ☐ | `SESSION_SECRET` | 64 hex (unik!) | Salin / generate baru |
| ☐ | `CRON_SECRET` | 64 hex | Salin dari `.env` lokal |
| ☐ | `ENVIRONMENT` | `PRODUCTION` (lokal masih `TESTING`!) | ⚠ UBAH ke PRODUCTION |
| ☐ | `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | lihat service 3 | Salin dari `.env` lokal |
| ☐ | `TELEGRAM_BOT_SECRET` | ⚠ SAMA ke owner + warehouse | Salin dari `.env` lokal |
| ☐ | `MOKA_SYNC_ENABLED` | `true` | Tetap true (data terbaru) |
| ☐ | `MOKA_SYNC_SECRET` | 64 hex | Salin dari `.env` lokal |
| ☐ | `MOKA_OUTLETS` | `SEKARPIZZA_TIRTODIPURAN,FUNKYDAK_COLOMBO,SUBURBUNS_COLOMBO` | Salin dari `.env` lokal |
| ☐ | `MOKA_<KEY>_{CLIENT_ID,CLIENT_SECRET,OUTLET_ID}` ×3 outlet | — | Salin dari `.env` lokal |
| ☐ | `USE_POSTGRES` + `DATABASE_URL` | opsional mirror PG | Isi bila mirror dipakai |
| ☐ | `DEFAULT_TZ` | `Asia/Jakarta` | Tetap |

## Service 5 — `warehouse` (:3005, base `ykp-warehouse-v1/`)

| ☐ | Var | Contoh format | Sumber |
|---|---|---|---|
| ☐ | `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `PRIVATE_KEY` | sama format | GCP (boleh 1 SA bareng HR) |
| ☐ | `YKP_WAREHOUSE_SPREADSHEET_ID` | ID spreadsheet | Spreadsheet warehouse |
| ☐ | `SESSION_SECRET` | 64 hex (unik!) | Generate baru |
| ☐ | `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | lihat service 3 | @BotFather / group |
| ☐ | `ENVIRONMENT` | `PRODUCTION` | Tetap |
| ☐ | `TELEGRAM_BOT_SECRET` | ⚠ SAMA dengan finance | Salin dari service 4 |
| ☐ | `YKP_HUB_ORIGIN` | `https://ykp-hub.<domain>` (⏱) | Domain service 1 |

## Service 6 — `investor` (:3006, base `ykp-investor-v1/`)

| ☐ | Var | Contoh format | Sumber |
|---|---|---|---|
| ☐ | `GOOGLE_*` + `YKP_INVESTOR_SPREADSHEET_ID` | sama format | GCP + spreadsheet investor |
| ☐ | `SESSION_SECRET` | 64 hex (unik!) | Generate baru |
| ☐ | `FINANCE_URL` | `https://ykp-finance.<domain>` | Domain service 4 |
| ☐ | `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | lihat service 3 | @BotFather / group |
| ☐ | `ENVIRONMENT` | `PRODUCTION` | Tetap |
| ☐ | `YKP_HUB_ORIGIN` | `https://ykp-hub.<domain>` (⏱) | Domain service 1 |

## Service 7 — `ops` (:3007, base `ykp-ops-v1/`)

| ☐ | Var | Contoh format | Sumber |
|---|---|---|---|
| ☐ | `GOOGLE_*` + `YKP_OPS_SPREADSHEET_ID` | sama format | GCP + spreadsheet ops |
| ☐ | `SESSION_SECRET` | 64 hex (unik!) | Generate baru |
| ☐ | `ENVIRONMENT` | `PRODUCTION` | Tetap |
| ☐ | `USE_MOCK_DB` | kosong/`false` di produksi | Build memakai `true`, runtime override |
| ☐ | `OPENAI_API_KEY` | `sk-...` | OpenAI (untuk triage/insight/vision) |
| ☐ | `AI_MODEL` | mis. `gpt-4o-mini` | Lihat `src/lib/ai.ts` |
| ☐ | `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | lihat service 3 | @BotFather / group |

## Service 8/9/10 — `erp-hr` `erp-finance` `erp-hermez` (base REPO ROOT, Dockerfile.coolify.*)

| ☐ | Var | Contoh format | Sumber |
|---|---|---|---|
| ☐ | `YKP_MASTER_DATABASE_URL` | `postgresql://user:pass@<pg-internal>:5432/ykp_master` | Coolify Postgres |
| ☐ | `YKP_HR_DATABASE_URL` | `.../ykp_hr` | Coolify Postgres |
| ☐ | `YKP_FINANCE_DATABASE_URL` | `.../ykp_finance` | Coolify Postgres |
| ☐ | `YKP_HERMEZ_DATABASE_URL` | `.../ykp_hermez` | Coolify Postgres |
| ☐ | `YKP_DB_PLAIN_TCP` | `true` | Tetap (butuh tasks 2.1) |
| ☐ | `CRON_SECRET` | 64 hex | Generate baru |
| ☐ | `ERP_SSO_SECRET` | ⚠ SAMA dengan hub | Salin dari service 1 |
| ☐ | `HERMEZ_BOT_DISABLED` | `true` (sampai token siap) | Tetap dulu |
| ☐ | Telegram / Supabase | bila dipakai | Lihat `ykp-erp/.env.example` |

## Service 11 — `hermez-bot` (worker, base `ykp-hermez/`)

| ☐ | Var | Contoh format | Sumber |
|---|---|---|---|
| ☐ | `TELEGRAM_BOT_TOKEN` | `123456:ABC...` (bot khusus chat) | @BotFather |
| ☐ | `TELEGRAM_OWNER_IDS` | `123456789,987654321` | ID Telegram owner |
| ☐ | `LLM_API_KEY` | `...` | Ollama Cloud |
| ☐ | `LLM_BASE_URL` | `https://ollama.com/v1` | Tetap |
| ☐ | `LLM_MODEL` | `deepseek-v4-flash` | Tetap |
| ☐ | `YKP_{FINANCE,HR,WAREHOUSE,OPS,INVESTOR}_URL` | domain publik masing-masing | Domain service 3–7 |
| ☐ | `TELEGRAM_BOT_SECRET` | ⚠ SAMA dengan finance | Salin dari service 4 |

## Di luar Coolify

| ☐ | Lokasi | Aksi |
|---|---|---|
| ☐ | GitHub secrets | `YKP_FINANCE_URL` → domain Coolify finance; `MOKA_SYNC_SECRET` samakan service 4 (workflow `moka-daily-sync.yml`) |
| ☐ | GCP | Share tiap spreadsheet ke service account email (Editor) |
| ☐ | Pasca-deploy | Rotate `owner/owner123` di tiap app; rotate password dashboard Coolify; tutup `/register` publik |
