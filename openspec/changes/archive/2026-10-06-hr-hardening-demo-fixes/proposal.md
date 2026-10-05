# Proposal: HR Hardening Demo Fixes

## Why

Two demo-blocking/leak issues found while verifying client feedback (2026-10): the unauthenticated `GET /api/hr/notify/contract-reminders` leaks employee PII (names, ids, employment status, dates) to anyone who knows the URL, and Telegram link codes live in an in-memory Map — a container restart (Coolify deploys often) voids every active code mid-demo with "Kode tidak valid".

## What Changes

- `GET /api/hr/notify/contract-reminders` now requires the same `CRON_SECRET` auth as its POST (preview stays available to the owner via secret; middleware allowlist untouched — the POST cron path must remain public-reachable).
- Telegram link codes persist in a new `hr_telegram_link_codes` Sheet tab: SHA-256-hashed code + `user_id` + `expires_at` + `consumed_at`. `createLinkCode` (async) appends; `consumeLinkCode` looks up by hash, enforces TTL + one-time use, then binds `users.telegram_id` as before. No API/response shape changes.
- Bootstrap auto-creates the new tab (bootstrap iterates all `TABS`); mock store gains the tab for tests.

## Capabilities

### New Capabilities
- `hr/notify-endpoint-access`: access control for the scheduler-facing notification endpoints (secret-gated preview + cron POST).
- `hr/telegram-link-codes`: restart-safe, one-time, TTL-bound Telegram link codes stored hashed in the Sheets backend.

### Modified Capabilities
(none — no main specs exist yet)

## Impact

- Code: `ykp-hr-v1/src/app/api/hr/notify/contract-reminders/route.ts` (GET guard), `src/lib/telegram.ts` (link-code storage), `src/db/sheets.ts` (+1 TABS key + headers), `src/db/mock-store.ts` (+tab), `src/lib/telegram.test.ts` (mock-mode + await), `scripts/bootstrap-sheets.ts` (no change needed — iterates TABS).
- Deploy note: run `npm run sheets:bootstrap` once after deploy to create the new tab.
- Cross-app: none (consume route contract unchanged).