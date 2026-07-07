import { env } from '../config/env.js';
import { MT5HTTPBridge } from './mt5-http-bridge.js';

export interface SymbolInfo {
  symbol: string;
  digits: number;
  point: number;
  lotStep: number;
  minLot: number;
  maxLot: number;
  contractSize: number;
  pipValue: number;
}

export interface AccountInfo {
  login: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  sl?: number;
  tp?: number;
  price?: number;
  deviation?: number;
  comment?: string;
  magic?: number;
}

export interface OrderResult {
  ok: boolean;
  orderId: string;
  filled: boolean;
  filledPrice: number;
  error?: string;
}

export interface TradeInfo {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  entry: number;
  sl: number;
  tp: number;
  pnlUsd: number;
  openTime: string;
  closeTime?: string;
  status: 'open' | 'closed';
}

export interface MT5Bridge {
  symbolInfo(symbol: string): Promise<SymbolInfo>;
  getAccount(): Promise<AccountInfo>;
  getOpenTrades(): Promise<TradeInfo[]>;
  orderCalc(req: OrderRequest): Promise<{ margin: number; profit: number }>;
  sendOrder(req: OrderRequest): Promise<OrderResult>;
  closeTrade(orderId: string): Promise<OrderResult>;
}

/**
 * Deterministic mock bridge for Phase 2. Returns real-shaped data so risk-manager + UI can be tested.
 * For FX majors: lot step 0.01, contract size 100000, pip value $10/lot.
 */
export class MT5MockBridge implements MT5Bridge {
  private openTrades: Map<string, TradeInfo> = new Map();
  private orderSeq = 1000;

  async symbolInfo(symbol: string): Promise<SymbolInfo> {
    const upper = symbol.toUpperCase();
    const isFx = /^[A-Z]{6}$/.test(upper);
    if (!isFx) {
      // XAUUSD-like: 2 digits, point 0.01
      return {
        symbol: upper,
        digits: 2,
        point: 0.01,
        lotStep: 0.01,
        minLot: 0.01,
        maxLot: 100,
        contractSize: 100,
        pipValue: 1
      };
    }
    return {
      symbol: upper,
      digits: 5,
      point: 0.00001,
      lotStep: 0.01,
      minLot: 0.01,
      maxLot: 100,
      contractSize: 100000,
      pipValue: 10
    };
  }

  async getAccount(): Promise<AccountInfo> {
    return {
      login: 'MOCK-001',
      currency: 'USD',
      balance: 10000,
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      leverage: 100
    };
  }

  async getOpenTrades(): Promise<TradeInfo[]> {
    return Array.from(this.openTrades.values()).filter((t) => t.status === 'open');
  }

  async orderCalc(req: OrderRequest): Promise<{ margin: number; profit: number }> {
    const sym = await this.symbolInfo(req.symbol);
    const margin = (req.lots * sym.contractSize * (req.price ?? 1)) / 100;
    return { margin, profit: 0 };
  }

  async sendOrder(req: OrderRequest): Promise<OrderResult> {
    const orderId = `MOCK-${++this.orderSeq}`;
    const sym = await this.symbolInfo(req.symbol);
    const entry = req.price ?? (req.side === 'BUY' ? 1.1 : 1.1);
    const sl = req.sl ?? entry - 0.005;
    const tp = req.tp ?? entry + 0.01;
    this.openTrades.set(orderId, {
      orderId,
      symbol: req.symbol,
      side: req.side,
      lots: req.lots,
      entry,
      sl,
      tp,
      pnlUsd: 0,
      openTime: new Date().toISOString(),
      status: 'open'
    });
    return { ok: true, orderId, filled: true, filledPrice: entry };
  }

  async closeTrade(orderId: string): Promise<OrderResult> {
    const t = this.openTrades.get(orderId);
    if (!t) return { ok: false, orderId, filled: false, filledPrice: 0, error: 'order not found' };
    t.status = 'closed';
    t.closeTime = new Date().toISOString();
    t.pnlUsd = Math.random() * 100 - 30; // mock outcome
    return { ok: true, orderId, filled: true, filledPrice: t.entry };
  }

  /** Test helper: clear all mock state */
  _reset(): void {
    this.openTrades.clear();
    this.orderSeq = 1000;
  }
}

let _bridge: MT5Bridge | null = null;

export function getMt5Bridge(): MT5Bridge {
  if (_bridge) return _bridge;
  if (env.MT5_BRIDGE_URL) {
    _bridge = new MT5HTTPBridge();
  } else {
    _bridge = new MT5MockBridge();
  }
  return _bridge;
}