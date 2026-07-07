import logging
import os
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse

from .config import load_config
from .auth import require_bearer
from .models import OrderRequest
from . import mt5_client

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("ykp-mt5-bridge")

_cfg = None
_initialized = False


def get_cfg():
    global _cfg
    if _cfg is None:
        _cfg = load_config()
    return _cfg


def _check_init():
    if not _initialized:
        raise HTTPException(status_code=503, detail="MT5 not initialized")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _initialized
    cfg = get_cfg()
    log.info("initializing MT5 login=%s server=%s", cfg.login, cfg.server)
    mt5_client.init(cfg.login, cfg.password, cfg.server)
    _initialized = True
    log.info("MT5 ready")
    try:
        yield
    finally:
        log.info("shutting down MT5")
        mt5_client.shutdown()


app = FastAPI(title="YKP MT5 Bridge", version="0.1.0",
              docs_url=None, redoc_url=None, lifespan=lifespan)


def _bearer_auth():
    return require_bearer(expected_token=get_cfg().token)


@app.get("/health")
def health():
    cfg = get_cfg()
    return {"ok": _initialized, "login": cfg.login}


@app.get("/symbol/{symbol}", dependencies=[Depends(_bearer_auth)])
def symbol_ep(symbol: str):
    _check_init()
    try:
        return mt5_client.get_symbol(symbol).model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/account", dependencies=[Depends(_bearer_auth)])
def account_ep():
    _check_init()
    return mt5_client.get_account().model_dump()


@app.get("/trades/open", dependencies=[Depends(_bearer_auth)])
def open_ep():
    _check_init()
    return [t.model_dump() for t in mt5_client.list_open_trades()]


@app.post("/order/calc", dependencies=[Depends(_bearer_auth)])
async def calc_ep(req: OrderRequest):
    _check_init()
    return mt5_client.calc_order(req).model_dump()


@app.post("/order/send", dependencies=[Depends(_bearer_auth)])
async def send_ep(req: OrderRequest):
    _check_init()
    return mt5_client.send_order(req).model_dump()


@app.post("/trade/{order_id}/close", dependencies=[Depends(_bearer_auth)])
def close_ep(order_id: str):
    _check_init()
    return mt5_client.close_trade(order_id).model_dump()


@app.exception_handler(Exception)
async def unhandled(_req, exc: Exception):
    log.exception("unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"ok": False, "error": str(exc)})