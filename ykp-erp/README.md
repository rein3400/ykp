# YKP ERP Monorepo

Monorepo untuk sistem back-office YKP: HR, Finance, dan Hermez integration.

## Repositori

- `apps/hr` — HR & payroll dashboard (Next.js, port `3002`)
- `apps/finance` — Finance dashboard (Next.js, port `3003`)
- `apps/hermez` — Hermez integration orchestrator (Next.js, port `3004`)
- `packages/schema` — Drizzle schema & DB clients
- `packages/engine` — Background jobs, queues, scheduler logic
- `packages/ui` — Shared UI components + Tailwind preset
- `packages/auth` — Shared auth utilities
- `packages/config` — ESLint + TypeScript + Tailwind shared config

## Dev quickstart

```bash
# 1. Start infra
docker compose up -d

# 2. Install dependencies
npm install

# 3. Copy env template and fill secrets
cp .env.example .env

# 4. Run migrations (pg_advisory_xact_lock per DB)
npm run db:migrate

# 5. Seed dev data
npm run db:seed

# 6. Start all apps
npm run dev
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | concurrently runs hr, finance, hermez |
| `npm run build` | build all apps/packages |
| `npm run lint` | lint all |
| `npm run typecheck` | TS check all |
| `npm run db:generate` | drizzle-kit generate across all schemas |
| `npm run db:migrate` | migrate all 4 databases with advisory lock |
| `npm run db:seed` | dev seed |
| `npm run test` | vitest |
| `npm run smoke` | runtime smoke checks |

## Ports

| App | URL |
| --- | --- |
| HR | http://localhost:3002 |
| Finance | http://localhost:3003 |
| Hermez | http://localhost:3004 |

## Architecture summary

- npm workspaces; no pnpm/turbo.
- Postgres: four logical databases on one server.
- Redis: BullMQ job queues and cron coordination.
- Drizzle ORM + migrations per database.
- Hermez read-only boundary enforced in `packages/engine`; optional writeback via `HERMEZ_WRITEBACK_ENABLED`.

## Binding contract

Blueprint: YKP Hermez Architecture (see memory).
- Hermez: read-only consumer of source-of-truth data.
- Writeback: opt-in, audited, transactional.
- Scheduler: deterministic daily run via `HERMEZ_RUN_HOUR_UTC` + cron secret auth.