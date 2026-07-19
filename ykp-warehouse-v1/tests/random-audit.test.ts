import { describe, it, expect } from 'vitest';
import { pickAuditTargets, isoWeekTag, type AuditItem } from '../src/lib/random-audit';

const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

const items: AuditItem[] = [
  { item_id: 'ITM-1', item_name: 'Daging Sapi Sirloin', criticality: 'CRITICAL', active_status: 'active' },
  { item_id: 'ITM-2', item_name: 'Salmon Fillet', criticality: 'CRITICAL', active_status: 'active' },
  { item_id: 'ITM-3', item_name: 'Ayam Fillet', criticality: 'CRITICAL', active_status: 'active' },
  { item_id: 'ITM-4', item_name: 'Plastic Bag', criticality: 'STANDARD', active_status: 'active' },
  { item_id: 'ITM-5', item_name: 'Old Item', criticality: 'STANDARD', active_status: 'inactive' }
];

describe('pickAuditTargets', () => {
  it('picks requested count, CRITICAL first', () => {
    const t = pickAuditTargets(items, 2, seq([0]));
    expect(t).toHaveLength(2);
    expect(t.every((x) => x.criticality === 'CRITICAL')).toBe(true);
  });
  it('pads with STANDARD when CRITICAL exhausted', () => {
    const t = pickAuditTargets(items, 4, seq([0]));
    expect(t).toHaveLength(4);
    expect(t.filter((x) => x.criticality === 'CRITICAL')).toHaveLength(3);
    expect(t.some((x) => x.item_id === 'ITM-4')).toBe(true);
  });
  it('excludes inactive items', () => {
    const t = pickAuditTargets(items, 10, seq([0]));
    expect(t.some((x) => x.item_id === 'ITM-5')).toBe(false);
  });
  it('returns empty when no active items', () => {
    expect(pickAuditTargets([{ item_id: 'X', active_status: 'inactive' }], 3, seq([0]))).toHaveLength(0);
  });
  it('does not mutate input', () => {
    const before = JSON.stringify(items);
    pickAuditTargets(items, 3, seq([0.5]));
    expect(JSON.stringify(items)).toBe(before);
  });
});

describe('isoWeekTag', () => {
  it('formats ISO week', () => {
    expect(isoWeekTag(new Date('2026-07-18T10:00:00'))).toMatch(/^2026-W\d{2}$/);
  });
  it('same week for Mon and Sun of one ISO week', () => {
    const mon = isoWeekTag(new Date('2026-07-13T08:00:00')); // Monday W29
    const sun = isoWeekTag(new Date('2026-07-19T20:00:00')); // Sunday W29
    expect(mon).toBe(sun);
  });
});
