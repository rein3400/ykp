import { describe, expect, it } from 'vitest';
import { openingPdfTemplates } from './opening-pdfs';
const outlet = (name: string) => ({ outlet_id: 'OL1', outlet_name: name, brand_id: 'BR1', status: 'active' });
describe('opening PDF outlet mapping', () => {
  it('generates 30 Funkydak items with original departments', () => {
    const rows = openingPdfTemplates('funkydak', outlet('Funkydak Colombo'));
    expect(rows).toHaveLength(30);
    expect(rows.filter((r) => r.department === 'Kasir')).toHaveLength(8);
    expect(rows.filter((r) => r.department === 'Helper')).toHaveLength(11);
    expect(rows.filter((r) => r.department === 'Kitchen')).toHaveLength(11);
  });
  it.each(['Sekar Pizza Colombo', 'Sekar Pizza Tirtodipuran'])('maps 23 Shift 1 tasks to %s', (name) => {
    const rows = openingPdfTemplates('sekar-shift1', outlet(name));
    expect(rows).toHaveLength(23);
    expect(rows.filter((r) => r.department === 'Shift 1 — Kasir')).toHaveLength(8);
    expect(rows.filter((r) => r.department === 'Shift 1 — Helper')).toHaveLength(8);
    expect(rows.filter((r) => r.department === 'Shift 1 — Kitchen')).toHaveLength(7);
    expect(new Set(rows.map((r) => r.checklist_template_id)).size).toBe(23);
    expect(rows.every((r) => r.outlet_id === 'OL1' && r.required_photo === 'false' && r.target_value === '')).toBe(true);
  });
  it('rejects other outlets and inactive masters', () => {
    expect(() => openingPdfTemplates('funkydak', outlet('Suburbun'))).toThrow();
    expect(() => openingPdfTemplates('sekar-shift1', { ...outlet('Sekar Pizza Colombo'), status: 'inactive' })).toThrow();
  });
});
