# Tasks — HR Hardening Demo Fixes

## 1. Reminder endpoint access

- [ ] 1.1 `contract-reminders/route.ts`: GET requires `isCronAuthorized(req)` → 401 otherwise
- [ ] 1.2 Test: anonymous GET → 401 without employee data; valid `x-cron-secret` GET → 200

## 2. Telegram link code persistence

- [ ] 2.1 `src/db/sheets.ts`: add `TABS.telegramLinkCodes = 'hr_telegram_link_codes'` + TAB_HEADERS `[code_hash, user_id, created_at, expires_at, consumed_at]`
- [ ] 2.2 `src/db/mock-store.ts`: add TAB key + empty seeded rows
- [ ] 2.3 `src/lib/telegram.ts`: sheets-backed `createLinkCode` (async, stores sha256 hash + user_id + created_at + expires_at=now+10m WIB) and `consumeLinkCode` (findRow by hash, TTL + consumed_at checks, marks consumed_at, binds `users.telegram_id`); remove the Map
- [ ] 2.4 Update `telegram.test.ts` link suites for mock mode + async create; add restart-safety simulation test (fresh-module create → consume after "restart" of pending-code state is not required — persistence via tab rows; simulate by re-reading tab)

## 3. Verification

- [ ] 3.1 `npx tsc --noEmit` + `npm run lint` + `npm test` green in ykp-hr-v1
- [ ] 3.2 E2E dev: GET without secret → 401; GET with secret → 200; link code create → consume → one-time + TTL paths
- [ ] 3.3 Deploy note: `npm run sheets:bootstrap` in prod after deploy (creates the new tab)