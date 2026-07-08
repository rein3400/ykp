"""Thin MetaTrader5 SDK wrapper. Returns shape that matches src/modules/mt5-http-bridge.ts."""
import MetaTrader5 as mt5
from .models import SymbolInfo, AccountInfo, TradeInfo, OrderRequest, OrderResult, OrderCalc


# Brokers (Exness, etc.) often append a suffix to canonical FX pair names.
# We try the canonical name first, then common suffixes in order.
_SYMBOL_SUFFIXES = ("", "m", ".raw", "micro", ".ec", ".s", ".i", "c")


def init(login: int, password: str, server: str, terminal_path: str | None = None) -> None:
    kwargs: dict = {"login": login, "password": password, "server": server, "timeout": 30000}
    if terminal_path:
        # Attach to a specific terminal64.exe (needed when multiple MT5 builds are installed).
        kwargs["path"] = terminal_path
    if not mt5.initialize(**kwargs):
        err = mt5.last_error()
        raise RuntimeError(f"mt5.initialize failed: {err}")


def shutdown() -> None:
    mt5.shutdown()


def resolve_symbol(symbol: str) -> str:
    """Return the broker's actual symbol name for the given canonical pair.
    Falls back across common suffixes when the canonical name is not visible."""
    if mt5.symbol_info(symbol) is not None:
        return symbol
    for sfx in _SYMBOL_SUFFIXES:
        if not sfx:
            continue
        candidate = f"{symbol}{sfx}"
        if mt5.symbol_info(candidate) is not None:
            return candidate
    raise ValueError(f"symbol {symbol!r} not found (tried suffixes: {_SYMBOL_SUFFIXES})")


def get_symbol(symbol: str) -> SymbolInfo:
    resolved = resolve_symbol(symbol)
    info = mt5.symbol_info(resolved)
    if info is None:
        raise ValueError(f"symbol {symbol!r} not found")
    tick = mt5.symbol_info_tick(resolved)
    pip = info.point * 10  # pip = 10 points for FX 5-digit
    pip_value = info.trade_tick_value * (info.trade_tick_size / pip) if pip else info.trade_tick_value
    return SymbolInfo(
        symbol=info.name,
        digits=info.digits,
        point=info.point,
        lotStep=info.volume_step,
        minLot=info.volume_min,
        maxLot=info.volume_max,
        contractSize=info.trade_contract_size,
        pipValue=pip_value,
    )


def get_account() -> AccountInfo:
    a = mt5.account_info()
    if a is None:
        raise RuntimeError("mt5.account_info returned None")
    return AccountInfo(
        login=a.login,
        currency=a.currency,
        balance=a.balance,
        equity=a.equity,
        margin=a.margin,
        freeMargin=a.margin_free,
        leverage=a.leverage,
    )


def list_open_trades() -> list[TradeInfo]:
    pos = mt5.positions_get() or []
    out: list[TradeInfo] = []
    for p in pos:
        out.append(TradeInfo(
            orderId=str(p.ticket),
            symbol=p.symbol,
            side="BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL",
            lots=p.volume,
            entry=p.price_open,
            sl=p.sl,
            tp=p.tp,
            pnlUsd=p.profit,
            openTime=p.time,
            status="open",
        ))
    return out


def calc_order(req: OrderRequest) -> OrderCalc:
    resolved = resolve_symbol(req.symbol)
    side = mt5.ORDER_TYPE_BUY if req.side == "BUY" else mt5.ORDER_TYPE_SELL
    # Fall back to current market price when caller does not supply one — passing 0.0
    # can crash order_calc_margin on some symbols.
    ref_price = req.price if req.price else _current_price(resolved, req.side)
    margin = mt5.order_calc_margin(side, resolved, req.lots, ref_price)
    profit = mt5.order_calc_profit(side, resolved, req.lots, ref_price, req.tp or 0.0) or 0.0
    return OrderCalc(margin=margin or 0.0, profit=profit)


def _current_price(symbol: str, side: str) -> float:
    """Return latest market price for the given side. Raises if tick unavailable."""
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        raise ValueError(f"no tick for {symbol!r}")
    return tick.ask if side == "BUY" else tick.bid


def send_order(req: OrderRequest) -> OrderResult:
    resolved = resolve_symbol(req.symbol)
    side = mt5.ORDER_TYPE_BUY if req.side == "BUY" else mt5.ORDER_TYPE_SELL
    # Explicit parentheses — `or` binds looser than the conditional expression.
    price = req.price if req.price else _current_price(resolved, req.side)
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": resolved,
        "volume": req.lots,
        "type": side,
        "price": price,
        "sl": req.sl or 0.0,
        "tp": req.tp or 0.0,
        "deviation": req.deviation or 10,
        "magic": req.magic or 0,
        "comment": req.comment or "ykp-bridge",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    if result is None:
        return OrderResult(ok=False, error=str(mt5.last_error()))
    ok = result.retcode == mt5.TRADE_RETCODE_DONE
    return OrderResult(
        ok=ok,
        orderId=str(result.order) if result.order else None,
        filled=ok,
        filledPrice=result.price if ok else None,
        error=None if ok else f"{result.retcode}: {result.comment}",
    )


def close_trade(order_id: str) -> OrderResult:
    pos_list = mt5.positions_get() or []
    pos = next((p for p in pos_list if str(p.ticket) == order_id), None)
    if pos is None:
        return OrderResult(ok=False, error=f"order {order_id} not found or not open")
    side = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
    tick = mt5.symbol_info_tick(pos.symbol)
    price = tick.bid if side == mt5.ORDER_TYPE_SELL else tick.ask
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "position": pos.ticket,
        "symbol": pos.symbol,
        "volume": pos.volume,
        "type": side,
        "price": price,
        "deviation": 10,
        "magic": pos.magic,
        "comment": "ykp-close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    if result is None:
        return OrderResult(ok=False, error=str(mt5.last_error()))
    ok = result.retcode == mt5.TRADE_RETCODE_DONE
    return OrderResult(
        ok=ok,
        orderId=str(result.order) if result.order else None,
        filled=ok,
        filledPrice=result.price if ok else None,
        error=None if ok else f"{result.retcode}: {result.comment}",
    )