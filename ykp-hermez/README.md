# YKP Hermez

Owner's AI assistant on Telegram. Free-form Indonesian chat over **all** YKP
module data (finance, warehouse, ops, HR, investor) — read-only by doctrine.

## What it does

- **Free-form chat**: "gimana cabang Cipete minggu ini?", "margin geprek bulan ini?", "ada yang aneh gak hari ini?"
- **Commands**: `/today /sales /margin /stok /sdm /alert /audit /foto /help`
- **AI daily brief** at 22:05 WIB: anomalies + recommendations (not template text)
- **Watch rules**: "kabari kalau margin geprek < 30%" — evaluated every 30 min
- **Photo Q&A**: send a struk/weigh-in photo, Hermez analyzes it
- **Voice notes**: transcribed (lite model), then answered
- Every Q&A logged to `data/chat-log.jsonl`

## Architecture

```
Telegram (long poll) → src/index.ts → src/brain.ts (agent loop)
    → OpenRouter (tool_use) → src/tools.ts
    → module PUBLIC endpoints (same ones the owner dashboard uses)
```

- No webhook/public URL needed (long polling).
- **Read-only**: no tool ever mutates company data. Watch rules write only
  to Hermez's own `data/` dir.
- Owner whitelist via `TELEGRAM_OWNER_IDS`; everyone else gets a refusal.

## Setup

```bash
cp .env.example .env   # fill values
npm install
npm run build
```

Required env:

| Var | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Same bot as the module alert pushes (united bot) |
| `TELEGRAM_OWNER_IDS` | Comma-separated numeric Telegram user IDs (from @userinfobot) |
| `OPENROUTER_API_KEY` | OpenRouter key |
| `YKP_*_URL` | Module base URLs (same as owner app) |

Optional: `OPENROUTER_MODEL` (default `anthropic/claude-sonnet-4`),
`OPENROUTER_LITE_MODEL` (voice transcription, default `google/gemini-2.0-flash-001`).

## Run

```bash
npm start            # production
```

Dry-run (no bot token): starts, logs, does not poll — useful for local checks.

## Windows service (NSSM)

```powershell
nssm install YKPHermez "C:\Program Files\nodejs\node.exe" "D:\YKP ERP\ykp\ykp-hermez\dist\index.js"
nssm set YKPHermez AppDirectory "D:\YKP ERP\ykp\ykp-hermez"
nssm set YKPHermez AppStdout "D:\YKP ERP\ykp\ykp-hermez\data\out.log"
nssm set YKPHermez AppStderr "D:\YKP ERP\ykp\ykp-hermez\data\err.log"
nssm start YKPHermez
```

Env vars: the service auto-loads `.env` from its working directory
(real env vars win over the file), so `AppDirectory` above is enough.

## Notes

- Watch rules + chat offset + chat log live in `data/` (gitignored).
- Modules must be reachable at the `YKP_*_URL`s; dead modules degrade to
  "data not available" answers instead of crashing the chat.
