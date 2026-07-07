# MT5 Bridge Service (separately deployable)

This is the optional Python FastAPI service that wraps the MetaTrader5 Python SDK and exposes HTTP endpoints consumed by the orchestrator `MT5HTTPBridge`.

Because the MetaTrader5 Python SDK runs only on Windows, the bridge is **not** included in the default `docker-compose.yml` stack. It must run on a Windows host (or Windows VM) with MetaTrader 5 installed.

## Endpoints consumed by Node orchestrator

- `GET /symbol/{symbol}` → SymbolInfo
- `GET /account` → AccountInfo
- `GET /trades/open` → TradeInfo[]
- `POST /order/calc` → { margin, profit }
- `POST /order/send` → OrderResult
- `POST /trade/{orderId}/close` → OrderResult

Auth: `Authorization: Bearer <MT5_BRIDGE_TOKEN>`.

## Required environment variables

- `MT5_LOGIN`
- `MT5_PASSWORD`
- `MT5_SERVER`
- `MT5_BRIDGE_TOKEN`

## Orchestrator configuration

Set in `.env`:

```env
MT5_BRIDGE_URL=http://host.docker.internal:8765
MT5_BRIDGE_TOKEN=token
```

Then run with the optional compose profile:

```bash
docker compose --profile mt5 up mt5-bridge
```

In production on Windows, deploy `mt5-bridge-service/` directly via Python virtualenv or a Windows Service.

## Reference API

- Node bridge: `orchestrator/src/modules/mt5-http-bridge.ts`
- Mock bridge for Phase 2 testing: `orchestrator/src/modules/mt5-bridge.ts`
