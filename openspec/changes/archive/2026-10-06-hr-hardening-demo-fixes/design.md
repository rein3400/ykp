# Design — HR Hardening Demo Fixes

## Context

`GET /api/hr/notify/contract-reminders` deliberately sits on the middleware PUBLIC list so the Coolify cron runner (no session cookie) can POST it; the route guards POST with `isCronAuthorized` but left GET open — a PII leak. Link codes (`src/lib/telegram.ts:173-199`) are a module-level Map: correct single-process, void after every redeploy. `hr` already persists other bot wiring in tabs (`telegram_delivery_log` precedent).

## Goals / Non-Goals

**Goals:** secret-gated preview; restart-safe one-time link codes with hashed storage; zero change to route contracts (`{code, expiresInSeconds}` response and consume request/response unchanged).

**Non-Goals:** no per-employee reminder fan-out redesign, no email channel for reminders (separate scope), no multi-code-per-user policy changes, no rate limiting on the endpoints beyond existing global middleware.

## Decisions

1. **GET guarded by `isCronAuthorized(req)`** — same check as POST. Alternative (session-auth on GET) would break owner test-firing from scripts/tunnels that only hold the cron secret.
2. **New tab `hr_telegram_link_codes`, headers `[code_hash, user_id, created_at, expires_at, consumed_at]`** — follows `telegram_delivery_log` precedent; bootstrap iterates `Object.values(TABS)` so the tab self-creates on next `npm run sheets:bootstrap`; no manual spreadsheet surgery.
3. **SHA-256 hash of the trimmed-uppercase code as the row key** — a leaked sheet grant can't mint link codes; consume path hashes the presented code and `findRow`s by `code_hash`.
4. **TTL compare on WIB timestamp strings** (`formatTimestampWib` everywhere) — lexicographically safe in the single `YYYY-MM-DD HH:mm:ss` format; no timezone math drift.
5. **`createLinkCode` becomes async** — the only production caller (`/api/hr/telegram/link`) already awaits it; tests are updated. Consume race window (two bot calls within ms) accepted for pilot scale — worst case both bind (same chat id, idempotent outcome).

## Risks / Trade-offs

- [Sheets write latency on code create (~100ms)] → acceptable: one-time user action, route already does several tab reads.
- [New tab needs one-time bootstrap run in prod] → documented in tasks; bootstrap is idempotent.
- [Hash scan is full-tab findRow] → tab stays small (codes expire; opportunistic purge appended rows are rare) — fine at pilot scale.

## Migration Plan

1. Deploy hr-v1 → run `npm run sheets:bootstrap` (creates the tab) → cron/tasks unchanged.
2. Rollback: previous image keeps working — it never reads this tab; leftover rows harmless.

## Open Questions

(none)