import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the sheets DB so the public summary route can be exercised without GCP.
const readTabMock = vi.fn();
const appendRowsMock = vi.fn();
vi.mock('@/db/sheets', () => ({
  readTab: (...a: unknown[]) => readTabMock(...a),
  appendRows: (...a: unknown[]) => appendRowsMock(...a),
  TABS: { summary: 'investor_daily_summary', capital: 'investor_capital' },
}));

// Stub session: the summary GET is public (no session read); capital POST
// needs an owner session.
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => ({ userId: 'U-1', role: 'owner', investorId: '' })),
}));
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => null) }));
// Prevent the dynamic import of regenerateInvestorSummary from touching sheets.
vi.mock('@/lib/investor-summary', () => ({
  regenerateInvestorSummary: vi.fn(async () => ({})),
}));

import { GET as summaryGet } from '@/app/api/investor/summary/route';
import { POST as capitalPost } from '@/app/api/investor/capital/route';

// The route handlers are wrapped by `handler()` which awaits ctx.params.
// Tests must pass a ctx with a resolved params object.
const ctx = { params: Promise.resolve({} as Record<string, string>) };

function asReq(body: unknown): import('next/server').NextRequest {
  return new Request('http://localhost/api/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }) as unknown as import('next/server').NextRequest;
}

describe('investor summary route — bug #1 (no cross-date leak)', () => {
  beforeEach(() => readTabMock.mockReset());

  it('returns only today rows when today has data', async () => {
    readTabMock.mockResolvedValue([
      { date: '2026-08-21', total_capital: '1000' },
      { date: '2026-08-19', total_capital: '9999' }
    ]);
    const res = await summaryGet(asReq(null), ctx);
    const json = await res.json();
    expect(json.data.items).toHaveLength(1);
    expect(json.data.items[0].date).toBe('2026-08-21');
  });

  it('returns empty list on a no-data date instead of stale rows', async () => {
    // Only stale rows from other dates present — must NOT leak them.
    readTabMock.mockResolvedValue([
      { date: '2026-08-19', total_capital: '5000', dividend_declared: '1000', total_revenue: '9000' },
      { date: '2026-08-18', total_capital: '4000', dividend_declared: '900', total_revenue: '8000' }
    ]);
    const res = await summaryGet(asReq(null), ctx);
    const json = await res.json();
    expect(json.data.items).toEqual([]);
    // Ensure none of the stale financials surface.
    expect(JSON.stringify(json)).not.toContain('5000');
    expect(JSON.stringify(json)).not.toContain('9000');
  });
});

describe('investor capital route — bug #2 (integer IDR validation)', () => {
  it('rejects formatted strings like "Rp 5.000" with 400', async () => {
    const res = await capitalPost(asReq({ investor_id: 'INV-1', amount: 'Rp 5.000' }), ctx);
    expect(res.status).toBe(400);
    expect(appendRowsMock).not.toHaveBeenCalled();
  });

  it('rejects decimals like "5000.5" with 400', async () => {
    const res = await capitalPost(asReq({ investor_id: 'INV-1', amount: '5000.5' }), ctx);
    expect(res.status).toBe(400);
    expect(appendRowsMock).not.toHaveBeenCalled();
  });

  it('rejects non-numeric like "abc" with 400', async () => {
    const res = await capitalPost(asReq({ investor_id: 'INV-1', amount: 'abc' }), ctx);
    expect(res.status).toBe(400);
  });

  it('accepts a plain integer and stores it as a string', async () => {
    appendRowsMock.mockResolvedValue(undefined);
    const res = await capitalPost(asReq({ investor_id: 'INV-1', amount: '500000000' }), ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.amount).toBe('500000000');
  });

  it('accepts a negative integer (capital out via amount sign)', async () => {
    appendRowsMock.mockResolvedValue(undefined);
    const res = await capitalPost(asReq({ investor_id: 'INV-1', amount: '-50000' }), ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.amount).toBe('-50000');
  });
});