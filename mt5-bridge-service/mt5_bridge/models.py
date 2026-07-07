from pydantic import BaseModel, Field
from typing import Literal


class SymbolInfo(BaseModel):
    symbol: str
    digits: int
    point: float
    lotStep: float
    minLot: float
    maxLot: float
    contractSize: float
    pipValue: float


class AccountInfo(BaseModel):
    login: int
    currency: str
    balance: float
    equity: float
    margin: float
    freeMargin: float
    leverage: int


class TradeInfo(BaseModel):
    orderId: str
    symbol: str
    side: Literal["BUY", "SELL"]
    lots: float
    entry: float
    sl: float
    tp: float
    pnlUsd: float
    openTime: int
    closeTime: int | None = None
    status: Literal["open", "closed"] = "open"


class OrderRequest(BaseModel):
    symbol: str
    side: Literal["BUY", "SELL"]
    lots: float = Field(gt=0)
    price: float | None = None
    sl: float | None = None
    tp: float | None = None
    deviation: int | None = 10
    comment: str | None = "ykp-bridge"
    magic: int | None = None


class OrderCalc(BaseModel):
    margin: float
    profit: float


class OrderResult(BaseModel):
    ok: bool
    orderId: str | None = None
    filled: bool = False
    filledPrice: float | None = None
    error: str | None = None