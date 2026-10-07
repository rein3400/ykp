import { describe, expect, it } from 'vitest';
import { selectChecklistTemplates, validateChecklistSubmission } from './checklist';
const templates: Record<string, string>[] = [
  { checklist_template_id: 'A', checklist_type: 'CLOSING', outlet_id: 'OL1', brand_id: 'BR1', checklist_item: 'Matikan kompor', critical_flag: 'true', active_status: 'active', required_photo: 'true' },
  { checklist_template_id: 'B', checklist_type: 'CLOSING', outlet_id: 'OL2', brand_id: 'BR1', checklist_item: 'Other outlet', active_status: 'active' }
];
describe('scoped closing checklist', () => {
  it('never falls back to templates belonging to other outlets', () => {
    expect(selectChecklistTemplates(templates, 'CLOSING', 'OL1', 'BR1')).toEqual([templates[0]]);
    expect(selectChecklistTemplates(templates, 'CLOSING', 'OL3', 'BR1')).toEqual([]);
  });
  it('rejects missing, unexpected and duplicate items, invalid statuses and absent required evidence', () => {
    const scoped = [templates[0]];
    for (const items of [[], [{ checklist_item: 'Unknown', status: 'DONE' }], [{ checklist_item: 'Matikan kompor', status: 'DONE' }], [{ checklist_item: 'Matikan kompor', status: 'INVALID' }]]) {
      expect(() => validateChecklistSubmission(scoped, items)).toThrow();
    }
    expect(() => validateChecklistSubmission(scoped, [
      { checklist_item: 'Matikan kompor', status: 'DONE', photo_url: 'https://example.com/a' },
      { checklist_item: 'Matikan kompor', status: 'DONE', photo_url: 'https://example.com/a' }
    ])).toThrow();
  });
  it('derives review status from critical incomplete items and accepts complete evidence', () => {
    expect(validateChecklistSubmission([templates[0]], [{ checklist_item: 'Matikan kompor', status: 'NOT_DONE', notes: 'Rusak' }]).status).toBe('NEEDS_REVIEW');
    expect(validateChecklistSubmission([templates[0]], [{ checklist_item: 'Matikan kompor', status: 'DONE', photo_url: 'https://example.com/a' }]).status).toBe('CLOSED');
  });
});
