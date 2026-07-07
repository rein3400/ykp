# YKP MT5 Bridge Service

Windows-native FastAPI wrapper around MetaTrader5 SDK. Deployed as a NSSM-managed Windows service on the same host that runs the MetaTrader5 terminal.

## Why Windows-only
The official `MetaTrader5` Python SDK links against the Windows-native terminal runtime. There is no Linux/macOS port — attempting to run this image under Docker Linux will silently fail on `mt5.initialize()`.

## Architecture
```
[Docker: ykp_api] --HTTP/Bearer--> [Windows host: YKPMT5Bridge (NSSM)]
                                              |
                                              v
                                       [MetaTrader5 terminal64.exe]
                                              |
                                              v
                                       [Broker server]
```
The orchestrator reaches the bridge via `MT5_BRIDGE_URL=http://host.docker.internal:8765`. Docker Desktop's `host.docker.internal` alias resolves to the Windows host loopback inside the WSL2 VM.

## Endpoints (contract)
`require_bearer(MT5_BRIDGE_TOKEN)` is enforced on every route except `/health`.
- `GET /health` → `{ok, login}` (no auth)
- `GET /symbol/{symbol}` → `{symbol, digits, point, lotStep, minLot, maxLot, contractSize, pipValue}`
- `GET /account` → `{login, currency, balance, equity, margin, freeMargin, leverage}`
- `GET /trades/open` → `[{orderId, symbol, side, lots, entry, sl, tp, pnlUsd, openTime, status}]`
- `POST /order/calc` body=`OrderRequest` → `{margin, profit}`
- `POST /order/send` body=`OrderRequest` → `{ok, orderId, filled, filledPrice, error?}`
- `POST /trade/{orderId}/close` → `OrderResult`

## Deploy (Windows host)
1. Install Python 3.11+ (x64). Test: `python --version`.
2. Download NSSM from nssm.cc → `C:\Tools\nssm\nssm.exe`. Add to PATH.
3. Verify MetaTrader5 terminal is installed and auto-logged-in to the production account.
4. Clone this folder onto the Windows host.
5. Edit `nssm\install_service.bat` — set `MT5_LOGIN`, `MT5_PASSWORD`, `MT5_SERVER`, `MT5_BRIDGE_TOKEN`, `PYTHON_EXE`.
6. Run `scripts\install.bat` to create venv + install deps.
7. Run `nssm\install_service.bat` to register the Windows service.
8. Verify: `nssm status YKPMT5Bridge` → `SERVICE_RUNNING`. `curl -H "Authorization: Bearer <token>" http://127.0.0.1:8765/health`.

## Smoke test
```bat
curl -s -H "Authorization: Bearer %MT5_BRIDGE_TOKEN%" http://127.0.0.1:8765/account
curl -s -H "Authorization: Bearer %MT5_BRIDGE_TOKEN%" http://127.0.0.1:8765/symbol/EURUSD
```

## Logs
Service stdout/stderr → `logs\service.out.log`, `logs\service.err.log` (NSSM-managed, 10MB rotation).

## Operational notes
- **One process per account.** Never run two `YKPMT5Bridge` services against the same MT5 login concurrently — `mt5.positions_get()` / `mt5.order_send()` operate on global SDK state; concurrent processes will race orders.
- **Token rotation** does NOT require restart of the orchestrator if you also restart the bridge (`nssm restart YKPMT5Bridge`) and update the orchestrator's `.env.prod` (`MT5_BRIDGE_TOKEN`) then `docker compose restart api worker`.
- **Terminal session.** The MetaTrader5 terminal must remain logged in. If the terminal is restarted by the user, the bridge will start failing — restart `YKPMT5Bridge` to re-`mt5.initialize()`.

## Removal
```bat
nssm\uninstall_service.bat
```