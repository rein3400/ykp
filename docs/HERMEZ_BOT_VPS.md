# Hermez Telegram bot — VPS runbook

> Last updated: 2026-07-22  
> Goal: run the dialog bot (long-poll + LLM reply) 24/7 on a cheap VPS.  
> Source worker: `ykp-erp/apps/hermez/src/workers/bot-worker.mjs` (plain Node, no `@ykp/*`).

---

## Why VPS

Prod Hermez image (`Dockerfile.hermez.new`) is **web-only**. The env flag
`HERMEZ_BOT_WORKER_ENABLED=true` makes the web service **refuse** to start
in-process polling (`managed_by_worker_service`), but the dedicated Railway
worker service was never created. Result: **no process runs `getUpdates`**
→ Telegram messages never reach the LLM.

VPS is the cheapest always-on host for long-poll. Alternatives (Railway
worker, webhook mode) exist but VPS was chosen for cost.

---

## Architecture

```
Telegram ──getUpdates──▶ bot-worker.mjs (VPS, always-on)
                              │
                              ├─ /brief /omzet /hr /alerts ──HTTP──▶ Hermez WEB
                              │   (x-bot-secret)                      Railway
                              │                                       /api/hermez/bot-data
                              │
                              └─ free text / /sop ──HTTP──▶ Ollama Cloud
                                                             https://ollama.com/v1
                                                             model=glm-5.2
```

- Web Hermez (Railway) stays the DB owner and outbound sender.
- VPS worker is the **single** `getUpdates` consumer (no conflict with web).
- Keep `HERMEZ_BOT_WORKER_ENABLED=true` on Railway so web never also polls.

---

## Prerequisites

1. **VPS** — Ubuntu 22.04/24.04, 1 vCPU / 512 MB–1 GB RAM, public outbound
   HTTPS (to `api.telegram.org` + `ollama.com` + Railway hermez URL).
   Providers: Hetzner CX22 / Contabo / DigitalOcean droplet / any cheap VPS.
2. **SSH root access** to the VPS.
3. **Secrets** (already set on Railway Hermez — copy them):
   - `TELEGRAM_BOT_TOKEN` / `HERMEZ_TELEGRAM_BOT_TOKEN`
   - `OWNER_CHAT_ID` / `TELEGRAM_OWNER_CHAT_ID` (group `-5437367893`)
   - `OWNER_USER_IDS` (private DM, e.g. `5721500978`)
   - `HERMEZ_BOT_SECRET`
   - `LLM_API_KEY`, `LLM_BASE_URL=https://ollama.com/v1`, `LLM_MODEL=glm-5.2`
4. **`HERMEZ_WEB_URL`** must be the **public Railway URL**, not `127.0.0.1`:
   ```
   HERMEZ_WEB_URL=https://ykp-erp-hermez-production.up.railway.app
   ```

Verified 2026-07-22: Ollama Cloud key works, `glm-5.2` returns chat completions.

---

## Install (once)

From your laptop (repo root):

```bash
# 1. Copy the VPS package to the server
scp -r ykp-erp/apps/hermez/scripts/vps root@<VPS_IP>:/tmp/hermez-bot-vps

# 2. SSH in and run the installer
ssh root@<VPS_IP>
cd /tmp/hermez-bot-vps
bash install.sh
```

Installer does:
1. Create system user `hermez-bot` + `/opt/hermez-bot`
2. Install Node 22 (NodeSource)
3. Copy `bot-worker.mjs`
4. Seed `/opt/hermez-bot/.env` from example (mode 0600)
5. Install systemd unit `hermez-bot.service`, enable + start

---

## Configure secrets

```bash
nano /opt/hermez-bot/.env
# fill real values (see hermez-bot.env.example)
# CRITICAL: HERMEZ_WEB_URL must be the public Railway URL, not 127.0.0.1

systemctl restart hermez-bot
journalctl -u hermez-bot -n 50 --no-pager
```

Expected boot log:

```
[hermez-bot] boot web=https://ykp-erp-hermez-production.up.railway.app chat=-5437367893 token=set secret=set
[hermez-bot] polling started, web=https://ykp-erp-hermez-production.up.railway.app chat=-5437367893
```

---

## Railway side (one-time)

On Hermez web service (`ykp-erp-hermez`, project `ykp-erp-monorepo`):

```bash
# Keep worker-managed mode so web does NOT also poll
railway variable set HERMEZ_BOT_WORKER_ENABLED=true \
  --service ykp-erp-hermez --environment production -p 701f7b7d-5fd7-4625-b0fb-435a2d8b6ef7

# Optional: fix the wrong WEB URL that was set for a co-located worker
# (only needed if something still reads it from the web service)
railway variable set HERMEZ_WEB_URL=https://ykp-erp-hermez-production.up.railway.app \
  --service ykp-erp-hermez --environment production -p 701f7b7d-5fd7-4625-b0fb-435a2d8b6ef7
```

No Hermez web redeploy is required for env-only changes that the web
process does not use at runtime for bot polling (it already refuses to
start the bot when `HERMEZ_BOT_WORKER_ENABLED=true`).

---

## Smoke test

1. `journalctl -u hermez-bot -f` on VPS
2. In Telegram group `-5437367893` (or DM `5721500978`):
   - `/status` → should reply with poll counters
   - `/help` → command list
   - free text e.g. `berapa omzet hari ini?` → LLM reply via Ollama Cloud
   - `/brief` → brief text from Hermez web DB
3. Log should show:
   ```
   [hermez-bot] msg chat=-5437367893 fromBot=false text=...
   ```

---

## Ops commands

```bash
systemctl status hermez-bot
systemctl restart hermez-bot
systemctl stop hermez-bot
journalctl -u hermez-bot -f
journalctl -u hermez-bot --since "10 min ago"
```

---

## Update the worker

When `bot-worker.mjs` changes in the repo:

```bash
scp ykp-erp/apps/hermez/src/workers/bot-worker.mjs root@<VPS_IP>:/opt/hermez-bot/bot-worker.mjs
ssh root@<VPS_IP> 'chown hermez-bot:hermez-bot /opt/hermez-bot/bot-worker.mjs && systemctl restart hermez-bot'
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| No log after start | `journalctl -u hermez-bot -n 100`; missing env → process exits 1 and restarts |
| `missing TELEGRAM_BOT_TOKEN` | Fill `.env`, restart |
| `Maaf, chat ini tidak terdaftar` | Add chat id to `OWNER_CHAT_ID` / `OWNER_USER_IDS` |
| `/brief` returns error | `HERMEZ_WEB_URL` must be public Railway URL; `HERMEZ_BOT_SECRET` must match web |
| LLM error / empty reply | Confirm `LLM_API_KEY` + `LLM_MODEL=glm-5.2` + `LLM_BASE_URL=https://ollama.com/v1`; test with curl (see below) |
| Conflict / 409 getUpdates | Another process is polling the same token (Railway web? old worker?). Stop it. Only one poller allowed. |

### LLM smoke (from VPS)

```bash
curl -s https://ollama.com/v1/chat/completions \
  -H "Authorization: Bearer $LLM_API_KEY" \
  -H "content-type: application/json" \
  -d '{"model":"glm-5.2","messages":[{"role":"user","content":"ping"}],"max_tokens":50}'
```

### bot-data smoke (from VPS)

```bash
curl -s "https://ykp-erp-hermez-production.up.railway.app/api/hermez/bot-data?cmd=alerts" \
  -H "x-bot-secret: $HERMEZ_BOT_SECRET"
```

---

## Files in this package

| File | Purpose |
|---|---|
| `bot-worker.mjs` | Worker source (copy of `src/workers/bot-worker.mjs`) |
| `hermez-bot.env.example` | Env template (fill real secrets on VPS) |
| `hermez-bot.service` | systemd unit |
| `install.sh` | One-shot installer for Ubuntu 22.04/24.04 |
| `docs/HERMEZ_BOT_VPS.md` | This runbook |

---

## Cost note

Cheapest VPS (~$3–5/mo, 512 MB–1 GB) is enough. Bot is a single Node
process doing HTTP long-poll; memory footprint is small. No inbound ports
required (outbound HTTPS only).