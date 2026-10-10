import { describe, expect, it } from 'vitest';
import { closingPdfTemplates } from './closing-pdfs';
const outlet = (name: string) => ({ outlet_id: 'OL1', outlet_name: name, brand_id: 'BR1', status: 'active' });
describe('closing PDF mappings', () => {
  it.each([
    ['suburbun', 'Suburbun', 24],
    ['funkydak', 'Funkydak Colombo', 25],
    ['sekar-shift2', 'Sekar Pizza Colombo', 21],
    ['sekar-shift2', 'Sekar Pizza Tirtodipuran', 21]
  ] as const)('maps %s to %s with %i tasks', (source, name, total) => {
    const rows = closingPdfTemplates(source, outlet(name));
    expect(rows).toHaveLength(total);
    expect(new Set(rows.map((row) => row.checklist_template_id)).size).toBe(total);
    expect(rows.every((row) => row.outlet_id === 'OL1' && row.checklist_type === 'CLOSING' && row.required_photo === 'false' && row.target_value === '' && row.critical_flag === 'false')).toBe(true);
    if (source === 'suburbun') {
      expect(rows.filter((row) => row.department.startsWith('FOH'))).toHaveLength(11);
      expect(rows.filter((row) => row.department.startsWith('BOH'))).toHaveLength(13);
    }
    if (source === 'funkydak') {
      expect(rows.filter((row) => row.department === 'Kasir')).toHaveLength(8);
      expect(rows.filter((row) => row.department === 'Helper')).toHaveLength(9);
      expect(rows.filter((row) => row.department === 'Kitchen')).toHaveLength(8);
    }
  });
  it('rejects cross-brand, missing and inactive outlet mappings', () => {
    expect(() => closingPdfTemplates('suburbun', outlet('Funkydak Colombo'))).toThrow();
    expect(() => closingPdfTemplates('funkydak', { ...outlet('Funkydak Colombo'), status: 'inactive' })).toThrow();
    expect(() => closingPdfTemplates('sekar-shift2', { ...outlet('Sekar Pizza Colombo'), brand_id: '' })).toThrow();
  });
});
