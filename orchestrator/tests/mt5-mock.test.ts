import { describe, it, expect } from 'vitest';
import { MT5MockBridge } from '../src/modules/mt5-bridge.js';

describe('MT5MockBridge', () => {
  it('symbolInfo returns FX shape for 6-char pairs', async () => {
    const b = new MT5MockBridge();
    const s = await b.symbolInfo('EURUSD');
    expect(s.contractSize).toBe(100000);
    expect(s.lotStep).toBe(0.01);
  });

  it('sendOrder creates open trade with orderId', async () => {
    const b = new MT5MockBridge();
    const r = await b.sendOrder({ symbol: 'EURUSD', side: 'BUY', lots: 0.1 });
    expect(r.ok).toBe(true);
    expect(r.orderId).toMatch(/^MOCK-/);
    expect(r.filled).toBe(true);
  });

  it('getOpenTrades reflects sent orders', async () => {
    const b = new MT5MockBridge();
    await b.sendOrder({ symbol: 'GBPUSD', side: 'SELL', lots: 0.2 });
    const open = await b.getOpenTrades();
    expect(open.length).toBe(1);
    expect(open[0]?.symbol).toBe('GBPUSD');
  });

  it('closeTrade flips status to closed', async () => {
    const b = new MT5MockBridge();
    const r = await b.sendOrder({ symbol: 'EURUSD', side: 'BUY', lots: 0.1 });
    const c = await b.closeTrade(r.orderId);
    expect(c.ok).toBe(true);
  });

  it('closeTrade on unknown order returns ok=false', async () => {
    const b = new MT5MockBridge();
    const c = await b.closeTrade('unknown');
    expect(c.ok).toBe(false);
  });
});