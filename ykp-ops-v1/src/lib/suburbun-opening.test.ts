import { describe, expect, it } from 'vitest';
import { suburbunOpeningTemplates } from './suburbun-opening';

describe('Suburbuns PDF import', () => {
  it('contains exactly 25 outlet-scoped tasks with 12 FOH and 13 BOH items', () => {
    const rows = suburbunOpeningTemplates({ outlet_id: 'OL13', outlet_name: 'Suburbun', brand_id: 'BR3', status: 'active' });
    expect(rows).toHaveLength(25);
    expect(new Set(rows.map((row) => row.checklist_template_id)).size).toBe(25);
    expect(rows.filter((row) => row.department.startsWith('FOH'))).toHaveLength(12);
    expect(rows.filter((row) => row.department.startsWith('BOH'))).toHaveLength(13);
    expect(rows.every((row) => row.outlet_id === 'OL13' && row.brand_id === 'BR3' && row.checklist_type === 'OPENING' && row.required_photo === 'false' && row.critical_flag === 'false' && row.target_value === '')).toBe(true);
  });
  it('refuses incorrect, inactive or incomplete outlet mappings', () => {
    for (const outlet of [
      { outlet_id: 'OL1', outlet_name: 'Funkydak', brand_id: 'BR1', status: 'active' },
      { outlet_id: 'OL13', outlet_name: 'Suburbun', brand_id: 'BR3', status: 'inactive' },
      { outlet_id: '', outlet_name: 'Suburbun', brand_id: 'BR3', status: 'active' }
    ]) expect(() => suburbunOpeningTemplates(outlet)).toThrow();
  });
});
