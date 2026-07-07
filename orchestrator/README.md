# YKP AI Orchestrator

Modular orchestration backend for YKP Hermez / SRI ICT Silver Bullet assistant.
Telegram bot + TradingView webhook + AI router + SOP/HR/Finance/Owner bots + workers + dashboard.

## Stack
- Node.js 22 + TypeScript (strict)
- Fastify 5 + @fastify/cors + @fastify/helmet + @fastify/rate-limit + @fastify/static
- Drizzle ORM + PostgreSQL 17
- ioredis + BullMQ (workers)
- grammY (Telegram bot)
- OpenAI SDK + Ollama fetch (AI Router)
- Pino logger + system_logs table

## Structure
```
orchestrator/
├── src/
│   ├── app.ts, index.ts          # Fastify bootstrap
│   ├── config/                   # env (Zod) + constants
│   ├── db/                       # Drizzle schema + seed + migrate
│   ├── services/                 # redis, telegram, ai-router, logger
│   ├── modules/                  # domain modules (trading-engine, telegram-bot, sop-bot, owner-bot, hr-bot, finance-bot, journal, memory, screenshot, erp, auth)
│   ├── workers/                  # daily-report, backup, monitor
│   ├── routes/                   # fastify routes
│   ├── queues.ts                 # BullMQ schedulers
│   └── worker-entry.ts           # worker process entrypoint
├── dashboard/                    # static HTML served at /dashboard
├── docker-compose.yml            # postgres, redis, api, worker, ollama (profile)
└── Dockerfile
```

## Quick start (Docker)
```bash
cp .env.example .env
# fill TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID, OPENAI_API_KEY, TRADINGVIEW_WEBHOOK_SECRET, etc.
docker compose up --build
# api: http://localhost:3001
# dashboard: http://localhost:3001/dashboard
```

## Quick start (local dev)
```bash
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run db:migrate
npm run db:seed
npm run dev
# in another shell:
npm run worker
```

## Endpoints (PRD §17)
- GET /health, /health/detail
- POST /telegram/webhook (Telegram bot updates)
- POST /tradingview/webhook (SRI ICT signals)
- POST /ai/chat
- POST /sop/search
- POST /hr/report, /finance/report
- POST /screenshot/analyze
- POST /erp/sync-outlets, /erp/push-sales
- GET /outlets, /outlets/:id
- GET /trading/journal, POST /trading/journal, PATCH /trading/journal/:id
- GET /memory/:scope, POST /memory
- GET /reports/daily, /reports/finance, /reports/hr

## Telegram commands
- /status — server status (all roles)
- /omzet hari ini — omzet per outlet (owner/manager/finance)
- /report — daily summary (owner/manager)
- /hr telat hari ini — late employees (owner/manager/hr)
- /finance minggu ini — finance report (owner/manager/finance)
- /sop <query> — SOP search + AI summary
- /trading — last setups
- /journal — last journal entries
- /help

## TradingView webhook payload
```json
{
  "source": "tradingview",
  "pair": "XAUUSD",
  "timeframe": "M15",
  "signal": "MSS_BULL",
  "price": 4050.25,
  "session": "NY_SB",
  "timestamp": "2026-06-28T22:15:00+07:00",
  "bar_index": 15234
}
```
Signals: HTF_BIAS_BULL/BEAR · DOL_BUY/DOL_SELL · SWEEP_SSL/SWEEP_BSL · MSS_BULL/MSS_BEAR · IFVG_BULL/IFVG_BEAR · SMT_BULL/SMT_BEAR · SILVER_BULLET_TIME

Orchestrator enforces: No Sweep = No MSS · No MSS = No Trade · No IFVG = No Entry.

## Workers
- daily-report @ 23:30 WIB (Asia/Jakarta)
- backup @ 03:00 WIB (pg_dump + Telegram alert)
- monitor every 60s (Postgres + Redis health check)

## AI Router
Routes by task_type:
- sop → qwen (Ollama local)
- trading_reasoning → gpt
- coding → gpt
- image → gpt (placeholder)
- general → gpt

Fallback chain on failure: preferred → gpt → qwen → gemini → claude.

## Production deploy (Option A — Windows host)
- Copy `.env.prod.example` → `.env.prod`, fill real values. Never commit `.env.prod` (gitignored).
- Postgres creds parameterized: pass `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL` via compose env (compose aborts if `POSTGRES_PASSWORD` unset).
- Cloudflare Tunnel: `cloudflared` runs as a Windows service (NSSM) — see `scripts/cloudflared-service.bat`. Set `CLOUDFLARE_TUNNEL_TOKEN`, route `hermes.<domain>` → `http://host.docker.internal:3001`. Telegram webhook mode (`TELEGRAM_WEBHOOK_MODE=true`) registers `PUBLIC_BASE_URL/telegram/webhook` via `setWebhook`.
- MT5 bridge: native Windows service (NSSM) at `mt5-bridge-service/`. Orchestrator reaches it via `MT5_BRIDGE_URL=http://host.docker.internal:8765` (Bearer `MT5_BRIDGE_TOKEN`). MetaTrader5 SDK is Windows-only — never containerize.
- All ports bind `127.0.0.1` (no public exposure); ingress is Cloudflare Tunnel only.
- Migrations auto-run on API + worker startup via `pg_advisory_xact_lock` (anti-race).
- Backup: `pg_dump` (postgresql-client in image) → named volume `ykp_backups_data`, retention keeps 14 newest.

## Secret rotation (every 90 days)
Rotate in this order, restarting each affected service after each step:
1. `POSTGRES_PASSWORD` → update `.env.prod` + `DATABASE_URL` + `docker compose up -d postgres api worker` (existing volume keeps data; new password only affects new connections).
2. `MT5_BRIDGE_TOKEN` → update `.env.prod` + `mt5-bridge-service/.env` + restart `YKPMT5Bridge` (NSSM) then `docker compose up -d api worker`.
3. `TELEGRAM_WEBHOOK_SECRET` → update `.env.prod` + `docker compose up -d worker` (worker re-registers webhook with new secret).
4. `CLOUDFLARE_TUNNEL_TOKEN` → Cloudflare dashboard rotate → update `.env.prod` + reinstall `YKPCloudflared` service.
5. `API_KEY` → update clients + `.env.prod` + restart `api`.

## Status (MVP scope)
- MVP1 (infra/api/telegram/trading/ai/logs) ✅
- MVP2 (Ollama/SOP/Owner/Daily/Backup/Dashboard) ✅
- MVP3 (HR/Finance/Journal/Memory/Screenshot/ERP) ✅ stubs, integrations placeholder

See plan: `D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\plans\ykp-hermez-developer-brief-migration-v1-silly-tower.md`