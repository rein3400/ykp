import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TOOL_HANDLERS } from './tools.js';

function jsonOk<T>(data: T) {
  return new Response(JSON.stringify({ data: { items: Array.isArray(data) ? data : [] } }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

function jsonEnvelope(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

describe('Hermez tool handlers', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('get_overview aggregates data from all modules', async () => {
    fetchSpy.mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/finance/summary')) return jsonOk([{ revenue: '1000000', estimated_surplus: '500000', total_expense: '300000', outlet_name: 'A' }]);
      if (u.includes('/warehouse/summary')) return jsonOk([{ total_inventory_value: '2000000', critical_low_stock_count: '1', near_expiry_item_count: '0', unexplained_variance_value: '0', outlet_name: 'A' }]);
      if (u.includes('/ops/summary')) return jsonOk([{ outlet_name: 'A', outlet_ready_status: 'READY', checklist_completion_pct: '90', high_severity_incident_count: '0' }]);
      if (u.includes('/hr/summary')) return jsonOk([{ present_count: '5', late_count: '1', absent_count: '0', outlet_name: 'A' }]);
      if (u.includes('/investor/summary')) return jsonOk([{ net_return: '500000' }]);
      return jsonOk([]);
    });

    const result = await TOOL_HANDLERS.get_overview({ date: '2026-07-20' });
    expect(result).toMatchObject({
      date: '2026-07-20',
      keuangan: expect.objectContaining({ revenue: 1_000_000 }),
      gudang: expect.objectContaining({ nilai_inventori: 2_000_000 }),
      operasional: expect.objectContaining({ rows: 1 }),
      sdm: expect.objectContaining({ hadir: 5, terlambat: 1 }),
      investor: expect.objectContaining({ net_return: '500000' })
    });
  });

  it('get_overview degrades gracefully when all modules fail', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const result = await TOOL_HANDLERS.get_overview({});
    expect(result).toMatchObject({
      keuangan: expect.objectContaining({ revenue: 0, rows: 0 }),
      gudang: expect.objectContaining({ nilai_inventori: 0, stok_kritis: 0 }),
      sdm: expect.objectContaining({ hadir: 0, terlambat: 0, absen: 0 })
    });
  });

  it('get_hr handles empty summary rows', async () => {
    fetchSpy.mockResolvedValue(jsonOk([]));
    const result = await TOOL_HANDLERS.get_hr({ date: '2026-07-20' });
    expect(result).toMatchObject({ date: '2026-07-20', hadir: 0, terlambat: 0, absen: 0, cuti: 0 });
  });

  it('get_inventory aggregates warehouse summary', async () => {
    fetchSpy.mockResolvedValue(jsonOk([
      { total_inventory_value: '1000000', critical_low_stock_count: '2', stockout_risk_count: '1', near_expiry_item_count: '3', expired_item_count: '0', waste_value: '50000', estimated_purchase_value: '200000', outlet_name: 'A' }
    ]));
    const result = await TOOL_HANDLERS.get_inventory();
    expect(result).toMatchObject({
      nilai_inventori: 1_000_000,
      stok_kritis: 2,
      risiko_stockout: 1,
      near_expiry: 3
    });
  });

  it('get_alerts returns empty arrays when all endpoints fail', async () => {
    fetchSpy.mockRejectedValue(new Error('timeout'));
    const result = await TOOL_HANDLERS.get_alerts({});
    expect(result).toEqual({ alerts: [], actions: [] });
  });

  it('get_photos handles missing public attachment endpoints', async () => {
    // After R-002 attachments are protected; tools should return empty, not throw.
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'Unauthorized' } }), { status: 401 }));
    const result = await TOOL_HANDLERS.get_photos({ limit: 5 });
    expect(result).toEqual({ total: 0, photos: [], note: 'URL bisa dibuka langsung di browser' });
  });
});
