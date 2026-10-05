# Telegram Link Codes — Delta Spec

## Purpose

Makes employee↔bot registration codes survive application restarts, so linking never breaks mid-flow after a redeploy, while keeping codes short-lived and one-time.

## ADDED Requirements

### Requirement: Link codes persist in the Sheets backend

`createLinkCode(userId)` SHALL store each issued code in the `hr_telegram_link_codes` tab as a SHA-256 hash of the code with `user_id`, `created_at`, and `expires_at` (10 minutes, Asia/Jakarta). The plaintext code SHALL never be stored. Generation SHALL survive process restarts: a code issued before a restart remains consumable afterwards.

#### Scenario: code survives a restart

- **WHEN** a user generates a link code, the app restarts, and the user consumes the same code within the TTL
- **THEN** consumption succeeds and binds the Telegram chat id to the user

### Requirement: One-time consumption with TTL

`consumeLinkCode(code, chatId)` SHALL look up the code by its hash, reject unknown codes, codes past `expires_at`, and already-consumed codes (marked via `consumed_at`), and on success SHALL atomically mark `consumed_at` and bind `users.telegram_id` to the chat id. Return value remains the bound `user_id` or null.

#### Scenario: double consumption fails

- **WHEN** the same valid code is consumed twice
- **THEN** the first call binds the chat id and returns the user id, the second call returns null

#### Scenario: expired code fails

- **WHEN** a code older than 10 minutes is consumed
- **THEN** the call returns null