import { describe, it, expect } from 'vitest';
import { toCsv, csvEscape } from '../src/lib/csv';

describe('csv export helpers', () => {
  it('escapes fields with commas and quotes', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it('builds CSV with BOM and CRLF', () => {
    const csv = toCsv(['item_id', 'qty'], [{ item_id: 'ITM-1', qty: 10 }, { item_id: 'ITM-2', qty: 20 }]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('item_id,qty');
    expect(csv).toContain('ITM-1,10');
    expect(csv).toContain('\r\n');
  });
});
