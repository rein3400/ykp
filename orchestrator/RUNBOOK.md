# YKP HERMES — Production Runbook (Option A: Windows host)

## Start-up order
1. Login Windows host.
2. Start **Docker Desktop** (WSL2 backend). Verify with `docker run --rm hello-world`.
3. Start container stack:
   ```powershell
   cd "D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\orchestrator"
   docker compose --env-file .env.prod up -d --build
   ```
4. Verify DB migrations applied automatically: `docker logs ykp_api --tail 30` → "migrations applied (or already current)".
5. Start **MT5 bridge** Windows service:
   ```bat
   cd "D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\mt5-bridge-service"
   nssm\install_service.bat
   nssm status YKPMT5Bridge   # SERVICE_RUNNING
   curl -H "Authorization: Bearer %MT5_BRIDGE_TOKEN%" http://127.0.0.1:8765/account
   ```
6. Start **Cloudflare Tunnel** service:
   ```bat
   cd "D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\orchestrator\scripts"
   cloudflared-service.bat
   nssm status YKPCloudflared
   curl https://hermes.<domain>/health
   ```
7. Telegram handshake: send `/start` to `@justatestermaybot` from owner chat `5721500978`. Bot replies → ready.

## Health checks
- Container stack: `docker compose ps`
- API health: `curl https://hermes.<domain>/health/detail`
- MT5 bridge: `curl -H "Authorization: Bearer <tok>" http://127.0.0.1:8765/health`
- Tunnel: `cloudflared tunnel info ykp-hermez`

## Shutdown / rollback per phase
- Phase A5 (tunnel): `nssm stop YKPCloudflared`
- Phase A2 (MT5 bridge): `nssm stop YKPMT5Bridge`
- Phase A3+A1 (orchestrator): `docker compose down`
- Phase A3 (DB only): `docker compose down postgres` (volume remains)

## Rotation calendar
Every 90 days:
1. `POSTGRES_PASSWORD` + `DATABASE_URL`
2. `MT5_BRIDGE_TOKEN`
3. `TELEGRAM_WEBHOOK_SECRET`
4. `CLOUDFLARE_TUNNEL_TOKEN`
5. `API_KEY`

Rotate one secret at a time, verify health after each, then move to the next.

## Troubleshooting
- `curl /health` fails from internet → check `YKPCloudflared` status + Cloudflare Zero Trust ingress mapping.
- `curl /health` works but Telegram webhook no updates → check `TELEGRAM_WEBHOOK_MODE=true` + `PUBLIC_BASE_URL` + `setWebhook` logs in `ykp_worker`.
- MT5 bridge returns 401 → token mismatch between orchestrator `.env.prod` and bridge service env.
- MT5 bridge `mt5.initialize failed` → MetaTrader5 terminal not running / not logged in; restart terminal + `YKPMT5Bridge` service.
- `pg_dump not found` → rebuild image after Dockerfile added `postgresql-client`.
- `ERR_MODULE_NOT_FOUND 'tsx'` → devDep removed? Dockerfile still installs `tsx` no-save; verify with `docker compose build api`.
- Backup files gone → check named volume `ykp_backups_data` mounted on `api` and `worker`.

## Safety constraints
- Never expose ports `3001/5432/6379/6333` on `0.0.0.0` in prod; keep `127.0.0.1` only.
- Never run two `YKPMT5Bridge` services against the same MT5 login concurrently.
- Never commit `.env.prod` or the real `MT5_LOGIN`/`MT5_PASSWORD`/`TELEGRAM_BOT_TOKEN`.
