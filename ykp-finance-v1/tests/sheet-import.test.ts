import { describe, it, expect } from 'vitest';
import { extractSheetSource, csvEscape, valuesToCsv } from '../src/lib/sheet-import';

describe('extractSheetSource', () => {
  it('extracts spreadsheet id and gid', () => {
    expect(extractSheetSource('https://docs.google.com/spreadsheets/d/ABC123/edit#gid=1234567890')).toEqual({
      spreadsheetId: 'ABC123',
      gid: '1234567890'
    });
  });

  it('handles export URLs and no gid', () => {
    expect(extractSheetSource('https://docs.google.com/spreadsheets/d/ABC123/export?format=csv')).toEqual({
      spreadsheetId: 'ABC123'
    });
  });

  it('returns null for non-sheet URLs', () => {
    expect(extractSheetSource('https://example.com/foo')).toBeNull();
  });
});

describe('csvEscape', () => {
  it('escapes commas, quotes, and newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape(123)).toBe('123');
  });
});

describe('valuesToCsv', () => {
  it('renders a values grid into CSV and drops blank rows', () => {
    const csv = valuesToCsv([
      ['tanggal', 'outlet', 'gross_sales'],
      ['02/07/2026', 'Funkydak Cipete', 5200000],
      ['', '', '']
    ]);
    expect(csv).toBe(
      'tanggal,outlet,gross_sales\n02/07/2026,Funkydak Cipete,5200000'
    );
  });

  it('escapes cells with commas/quotes so the Moka importer can parse them', () => {
    const csv = valuesToCsv([['outlet'], ['Funkydak, Cipete']]);
    expect(csv).toBe('outlet\n"Funkydak, Cipete"');
  });
});
