# YKP HERMES — Production Deploy Progress

> Generated: 2026-07-07
> Plan: `C:\Users\stefa\.claude\plans\ykp-hermez-developer-brief-migration-v1-silly-tower.md`
> Strategy: Option A — Windows host primary, Docker Desktop/WSL2 orchestrator, Cloudflare Tunnel ingress, native Windows MT5 bridge.

## ✅ Completed

| # | Item | Evidence |
|---|---|---|
| A1 | `.env.prod` + `.env.prod.example` | `orchestrator/.env.prod` gitignored, 52 prod vars, Telegram token real. |
| A1 | Postgres creds parameterized | `docker-compose.yml:7-9` uses `${POSTGRES_USER}` / `${POSTGRES_PASSWORD:?required}`. |
| A1 | Port binding locked to `127.0.0.1` | `docker-compose.yml` ports for 5432/6379/6333/3001 bound to loopback only. |
| A2 | Python MT5 bridge implemented | `mt5-bridge-service/` — FastAPI, MetaTrader5 SDK wrapper, Pydantic models, Bearer auth, NSSM scripts, README. |
| A2 | Broken Linux `mt5-bridge` profile removed | `docker-compose.yml:112-126` replaced with comment pointing to Windows NSSM service. |
| A3 | Dockerfile hardened | `postgresql-client` installed, non-root `ykp` user, backup dir created. |
| A3 | Migration auto-run | `src/db/run-migrations.ts` with `pg_advisory_xact_lock`; called from `src/index.ts` + `src/worker-entry.ts`. |
| A3 | Backup retention | `src/workers/backup.ts` keeps newest 14 dumps. |
| A3 | Backup volume | Named volume `ykp_backups_data` mounted on api + worker. |
| A4 | Fastify request logging on | JSON request logs active (verified via `/health` access logs). |
| A4 | Helmet CSP enabled | CSP headers present on responses. |
| A4 | CORS origin whitelist | `src/app.ts` only allows `CORS_ORIGIN` or same-origin/no-origin. |
| A4 | Rate-limit allowList | `/health`, `/tradingview/webhook`, `/telegram/webhook` excluded from global 100 req/min. |
| A4 | Telegram webhook mode + idempotency | `src/modules/telegram-bot.ts` `setWebhook` checks `getWebhookInfo()` first. |
| A4 | Approvals `x-api-key` gate | `src/routes/approvals.ts` accepts owner/trader via `x-telegram-id` OR operator via `x-api-key`. |
| A4 | Uncaught handlers | `unhandledRejection` + `uncaughtException` in `src/index.ts` + `src/worker-entry.ts`. |
| A5 | NSSM + cloudflared.exe provisioned | Downloaded to `C:\Tools\nssm.exe` and `C:\Tools\cloudflared.exe`. |
| A5 | `scripts/cloudflared-service.bat` | NSSM service installer for `YKPCloudflared`. |
| A6 | News filter fail-safe | `NEWS_FILTER_ENABLED=true` + `NEWS_PROVIDER=stub` returns `ok:false`; dev can set `NEWS_FILTER_ENABLED=false`. |
| A6 | `RUNBOOK.md` | Start order, shutdown/rollback, rotation calendar, troubleshooting. |
| B1 | Prod secrets generated | `TELEGRAM_WEBHOOK_SECRET`, `MT5_BRIDGE_TOKEN`, `API_KEY` = 64-hex. |
| B2 | Tooling installed | Python 3.11.9 native at `C:\Python311`, MetaTrader5 SDK importable, NSSM/cloudflared ready. |
| B3 | MT5 bridge venv built | `mt5-bridge-service/.venv` Python 3.11 with `ykp-mt5-bridge` installed. |
| B5 | Orchestrator prod deploy | `docker compose --env-file .env.prod up -d --build` → all healthy. |
| B5 | Telegram bot live | `@justatestermaybot` long-poll active; test message delivered to owner chat `5721500978`. |

## Current Stack Status

```
ykp_api      Up 16 hours (healthy)   NODE_ENV=production
ykp_worker   Up 5 minutes            Telegram bot polling active
ykp_postgres Up 18 hours (healthy)
ykp_redis    Up 18 hours (healthy)
ykp_qdrant   Up 18 hours (healthy)
```

Health detail (`/health/detail`):
- `api`, `postgres`, `redis`, `qdrant` → ok
- `telegram`, `openai`, `ollama`, `embedding_provider` → configured
- `news_provider` → stub
- `mt5_bridge` → configured (http)

## End-to-End Smoke (local dev mode)

Sequence verified before switching `.env.prod` to `NEWS_FILTER_ENABLED=true`:
1. `HTF_BIAS_BULL → DOL_BUY → SWEEP_SSL → MSS_BULL → IFVG_BULL → SILVER_BULLET_TIME`
2. Result: `VALID_SETUP`, score 95, `PENDING`.
3. REST approve (`x-telegram-id: 123`) → `APPROVED`.
4. Mock execution → `trade_executions` row: `MOCK-1001 EURUSD BUY filled 0.1`.
5. Journal linked with `approvedAt`, `approvedBy`.
6. Audit logs: `approval:approved` → `execution:dispatch`.
7. Backup produced file `backup_2026_07_06.sql` in named volume.

With `.env.prod` current values (`NEWS_FILTER_ENABLED=true`), new signals will be `WAIT` with reason `news not clear: news filter disabled in stub mode`. This is intentional fail-safe until a real news provider is wired.

## 🛑 Remaining Manual Steps (require real credentials)

| # | Task | File to edit | How to complete |
|---|---|---|---|
| 1 | Set strong Postgres password | `.env.prod` | Replace `POSTGRES_PASSWORD=ykp` and `DATABASE_URL` password. |
| 2 | Set TradingView webhook secret | `.env.prod` | `TRADINGVIEW_WEBHOOK_SECRET` = 64-hex. Update TradingView alert message. |
| 3 | Set OpenAI API key | `.env.prod` | `OPENAI_API_KEY` for embeddings + AI chat. |
| 4 | Set Cloudflare Tunnel token + domain | `.env.prod` | `CLOUDFLARE_TUNNEL_TOKEN`, `PUBLIC_BASE_URL`, `CORS_ORIGIN`. Update `scripts/cloudflared-service.bat`. Then enable `TELEGRAM_WEBHOOK_MODE=true` and restart worker. |
| 5 | Set MT5 account credentials | `.env.prod` and `mt5-bridge-service/nssm/install_service.bat` | Fill `MT5_LOGIN`, `MT5_PASSWORD`, `MT5_SERVER`, `MT5_BRIDGE_TOKEN`. Run `nssm\install_service.bat`. Ensure MetaTrader5 terminal is logged in. |

## Notes

- Cloudflare Tunnel is **not mandated by the original developer brief V1**. It was chosen because the existing README (`orchestrator/README.md:111-113`) already had a `CLOUDFLARE_TUNNEL_TOKEN` slot and described using Cloudflare Tunnel for Telegram webhook HTTPS. Alternatives: ngrok, Caddy + Let's Encrypt, or a separate VPS reverse proxy.
- `TELEGRAM_WEBHOOK_MODE` is currently `false` in `.env.prod` because the tunnel domain is still a placeholder. Once step 4 above is complete, flip it to `true` and restart the worker.
- The MT5 bridge **must run natively on Windows** because the `MetaTrader5` Python SDK is Windows-only. The orchestrator reaches it via `MT5_BRIDGE_URL=http://host.docker.internal:8765`.
- `NEWS_FILTER_ENABLED=true` blocks all trades in stub mode by design. To allow smoke trades, temporarily set it to `false`.
