# YKP Hermez

Owner + department-head AI assistant on Telegram. Free-form Indonesian chat
over **all** YKP module data (finance, warehouse, ops, HR, investor) —
read-only by doctrine.

## What it does

- **Free-form chat**: "gimana cabang Cipete minggu ini?", "margin geprek bulan ini?", "ada yang aneh gak hari ini?"
- **Commands**: `/today /sales /margin /stok /sdm /alert /audit /foto /help`
- **AI daily brief** at 22:05 WIB: anomalies + recommendations (not template text)
- **Watch rules**: "kabari kalau margin geprek < 30%" — evaluated every 30 min
- Every Q&A logged to `data/chat-log.jsonl`

## Access control

- **Owner** (whitelist `TELEGRAM_OWNER_IDS`) sees everything.
- **Department heads** (`hr_admin`, `finance_admin`, `brand_manager`,
  `outlet_manager`, `supervisor`) are resolved via the HR app's public
  `/api/hr/telegram-actor` endpoint and see only their brand/outlet.
- Everyone else gets a polite refusal.

## Architecture

```
Telegram (long poll) → src/index.ts → src/brain.ts (agent loop)
    → Ollama Cloud (tool_use) → src/tools.ts
    → module PUBLIC endpoints (same ones the owner dashboard uses)
```

- No webhook/public URL needed (long polling).
- **Read-only**: no tool ever mutates company data. Watch rules write only
  to Hermez's own `data/` dir.
- LLM: `deepseek-v4-flash` via Ollama Cloud (text + tool calling; no
  vision/audio — voice/photo get a polite "not supported" reply).

## Setup

```bash
cp .env.example .env   # fill values
npm install
npm run build
```

Required env:

| Var | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | A **dedicated** bot token (do NOT reuse the absen bot — webhook vs long-poll conflict) |
| `TELEGRAM_OWNER_IDS` | Comma-separated numeric Telegram user IDs (from @userinfobot) |
| `LLM_API_KEY` | Ollama Cloud key |
| `LLM_BASE_URL` | `https://ollama.com/v1` |
| `LLM_MODEL` | `deepseek-v4-flash` |
| `YKP_*_URL` | Module base URLs (same as owner app) |

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

