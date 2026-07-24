import { describe, it, expect, beforeEach } from 'vitest';
import { mockReset, mockReadTab, mockAppendRows, mockFindRow } from './mock-store';
import { TABS } from './sheets';

function makeBriefingRow(id: string, text: string): Record<string, string> {
  return {
    briefing_id: id,
    date: '2026-07-24',
    brand_id: 'BR-001',
    brand_name: 'Funkydak',
    outlet_id: 'OL-001',
    outlet_name: 'Funkydak Kemang',
    shift_id: 'SH-001',
    shift_name: 'Morning',
    briefing_type: 'MANUAL',
    briefing_text: text,
    target_sales: '',
    priority_menu: '',
    stock_warning: '',
    staffing_warning: '',
    service_focus: '',
    generated_by_ai: 'false',
    manually_edited: 'true',
    approved_by: 'USR-001',
    published_status: 'PUBLISHED',
    published_at: '',
    created_at: '',
    updated_at: '',
  };
}

describe('mock-store singleton', () => {
  beforeEach(() => {
    process.env.USE_MOCK_DB = 'true';
    mockReset();
  });

  it('append then read returns the same row', () => {
    mockAppendRows(TABS.briefing, [makeBriefingRow('BRF-001', 'hello')]);
    const rows = mockReadTab(TABS.briefing);
    expect(rows.length).toBe(1);
    expect(rows[0].briefing_id).toBe('BRF-001');
    expect(rows[0].briefing_text).toBe('hello');
  });

  it('multiple appends accumulate in the same store', () => {
    mockAppendRows(TABS.briefing, [makeBriefingRow('BRF-001', 'first')]);
    mockAppendRows(TABS.briefing, [makeBriefingRow('BRF-002', 'second')]);
    const rows = mockReadTab(TABS.briefing);
    expect(rows.length).toBe(2);
    expect(rows[0].briefing_text).toBe('first');
    expect(rows[1].briefing_text).toBe('second');
  });

  it('seeded tabs (outlets) survive alongside appended briefing rows', () => {
    mockAppendRows(TABS.briefing, [makeBriefingRow('BRF-001', 'test')]);
    const briefRows = mockReadTab(TABS.briefing);
    const outletRows = mockReadTab(TABS.outlets);
    expect(briefRows.length).toBe(1);
    expect(outletRows.length).toBeGreaterThan(0);
    expect(outletRows[0].outlet_id).toBe('OL-001');
  });

  it('mockFindRow finds appended data', () => {
    mockAppendRows(TABS.briefing, [makeBriefingRow('BRF-001', 'find me')]);
    const result = mockFindRow(TABS.briefing, 'briefing_id', 'BRF-001');
    expect(result).not.toBeNull();
    expect(result!.row.briefing_text).toBe('find me');
  });

  it('mockReset clears appended data but re-seeds master tabs', () => {
    mockAppendRows(TABS.briefing, [makeBriefingRow('BRF-001', 'temp')]);
    expect(mockReadTab(TABS.briefing).length).toBe(1);
    mockReset();
    expect(mockReadTab(TABS.briefing).length).toBe(0);
    expect(mockReadTab(TABS.outlets).length).toBeGreaterThan(0);
  });

  it('store is shared across multiple getStore calls (singleton)', () => {
    // Write to briefing, then read outlets — both should hit the same store
    mockAppendRows(TABS.briefing, [makeBriefingRow('BRF-001', 'shared')]);
    const briefBefore = mockReadTab(TABS.briefing).length;
    // Simulate a "second module" reading: just call readTab again
    const briefAfter = mockReadTab(TABS.briefing).length;
    expect(briefBefore).toBe(briefAfter);
    expect(briefAfter).toBe(1);
  });
});