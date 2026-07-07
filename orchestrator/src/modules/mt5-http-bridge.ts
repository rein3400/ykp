import { env } from '../config/env.js';
import { withBreaker } from '../services/circuit-breaker.js';
import { logger } from '../services/logger.js';
import { db, schema } from '../db/index.js';
import { nanoid } from 'nanoid';
import type { MT5Bridge, SymbolInfo, AccountInfo, OrderRequest, OrderResult, TradeInfo } from './mt5-bridge.js';

const BREAKER = 'mt5-http';

export class MT5HTTPBridge implements MT5Bridge {
  private base: string;
  private token: string;
  private timeoutMs: number;

  constructor() {
    if (!env.MT5_BRIDGE_URL) throw new Error('MT5_BRIDGE_URL not set');
    this.base = env.MT5_BRIDGE_URL.replace(/\/$/, '');
    this.token = env.MT5_BRIDGE_TOKEN ?? '';
    this.timeoutMs = env.MT5_BRIDGE_TIMEOUT_MS;
  }

  private async fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    return withBreaker(BREAKER, async () => {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
        };
        const res = await fetch(`${this.base}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) }, signal: ctrl.signal });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          await this.recordFailure(path, `HTTP ${res.status}: ${errText}`);
          throw new Error(`MT5 HTTP ${res.status}: ${errText}`);
        }
        return await res.json() as T;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          await this.recordFailure(path, 'timeout');
        }
        throw err;
      } finally {
        clearTimeout(to);
      }
    });
  }

  private async recordFailure(endpoint: string, error: string): Promise<void> {
    try {
      await db.insert(schema.bridgeFailures).values({
        id: `BF-${nanoid(12)}`,
        bridge: BREAKER,
        endpoint,
        error
      });
    } catch (e) {
      logger.warn({ err: e }, 'bridgeFailures insert failed');
    }
  }

  async symbolInfo(symbol: string): Promise<SymbolInfo> {
    return this.fetchJson<SymbolInfo>(`/symbol/${encodeURIComponent(symbol)}`);
  }

  async getAccount(): Promise<AccountInfo> {
    return this.fetchJson<AccountInfo>('/account');
  }

  async getOpenTrades(): Promise<TradeInfo[]> {
    return this.fetchJson<TradeInfo[]>('/trades/open');
  }

  async orderCalc(req: OrderRequest): Promise<{ margin: number; profit: number }> {
    return this.fetchJson<{ margin: number; profit: number }>('/order/calc', {
      method: 'POST',
      body: JSON.stringify(req)
    });
  }

  async sendOrder(req: OrderRequest): Promise<OrderResult> {
    return this.fetchJson<OrderResult>('/order/send', {
      method: 'POST',
      body: JSON.stringify(req)
    });
  }

  async closeTrade(orderId: string): Promise<OrderResult> {
    return this.fetchJson<OrderResult>(`/trade/${encodeURIComponent(orderId)}/close`, { method: 'POST' });
  }
}