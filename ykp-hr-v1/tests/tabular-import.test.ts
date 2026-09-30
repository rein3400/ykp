import { describe, expect, it } from 'vitest';
import { cellToString, csvToRows, isXlsxName, recordsToRecords } from '../src/lib/tabular-import';

describe('tabular-import (CSV/Excel)', () => {
  it('membaca CSV koma biasa', () => {
    const rows = csvToRows('full_name,outlet_id,basic_salary\nBudi,OL-012,3000000');
    expect(rows).toEqual([{ full_name: 'Budi', outlet_id: 'OL-012', basic_salary: '3000000' }]);
  });

  it('membaca CSV Excel Indonesia (titik-koma) + BOM', () => {
    const rows = csvToRows('\ufefffull_name;outlet_id;basic_salary\r\nAmirul;OL-012;0\r\n');
    expect(rows[0]).toEqual({ full_name: 'Amirul', outlet_id: 'OL-012', basic_salary: '0' });
  });

  it('tahan email multi-baris dalam tanda petik', () => {
    const csv = 'full_name;email\nBrahma;"\nbrahma@x.com"\nAri;ari@x.com';
    const rows = csvToRows(csv);
    expect(rows[0].full_name).toBe('Brahma');
    expect(rows[0].email.trim()).toBe('brahma@x.com');
    expect(rows[1].full_name).toBe('Ari');
  });

  it('mengubah sel Date → YYYY-MM-DD dan null → kosong', () => {
    expect(cellToString(new Date(2026, 6, 1))).toBe('2026-07-01');
    expect(cellToString(null)).toBe('');
    expect(cellToString(2700000)).toBe('2700000');
  });

  it('recordsToRecords memetakan header + baris', () => {
    const recs = recordsToRecords([
      ['full_name', 'outlet_id'],
      ['Sari', 'OL-012']
    ]);
    expect(recs).toEqual([{ full_name: 'Sari', outlet_id: 'OL-012' }]);
  });

  it('menemukan baris header walau ada judul + instruksi di atas (template Excel)', () => {
    const recs = recordsToRecords([
      ['TEMPLATE 3 — DATA KARYAWAN', null, null],
      ['HR/Admin · Impor ke: HR', null, null],
      ['full_name', 'outlet_id', 'basic_salary'],
      ['Amirul', 'OL-012', 0]
    ]);
    expect(recs).toEqual([{ full_name: 'Amirul', outlet_id: 'OL-012', basic_salary: '0' }]);
  });

  it('mengenali nama file xlsx', () => {
    expect(isXlsxName('Data Karyawan.xlsx')).toBe(true);
    expect(isXlsxName('data.csv')).toBe(false);
  });
});
