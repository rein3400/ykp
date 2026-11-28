import { describe, it, expect } from 'vitest';
import {
  filterReferences,
  toggleDone,
  countDone,
  addPlan,
  removePlan,
  setPlanStatus,
  filterPlans,
  ALL_BRANDS
} from './marketing-state';
import { CONTENT_REFERENCES, META_GUIDE_ITEMS } from '@/data/marketing-preview';

describe('marketing state', () => {
  it('filters references by brand, shows all for the default', () => {
    expect(filterReferences(CONTENT_REFERENCES, ALL_BRANDS)).toHaveLength(
      CONTENT_REFERENCES.length
    );
    const sekar = filterReferences(CONTENT_REFERENCES, 'Sekar Pizza');
    expect(sekar.length).toBeGreaterThan(0);
    expect(sekar.every((r) => r.brand === 'Sekar Pizza')).toBe(true);
  });

  it('toggles a guide item without mutating the input', () => {
    const id = META_GUIDE_ITEMS[0].id;
    const before = META_GUIDE_ITEMS[0].done;
    const next = toggleDone(META_GUIDE_ITEMS, id);
    expect(next).not.toBe(META_GUIDE_ITEMS);
    expect(next.find((i) => i.id === id)!.done).toBe(!before);
    expect(META_GUIDE_ITEMS[0].done).toBe(before);
  });

  it('counts done items', () => {
    expect(countDone([{ ...META_GUIDE_ITEMS[0], done: true }])).toBe(1);
  });

  it('adds, updates, removes and filters plans immutably', () => {
    const base = {
      id: 'P1',
      title: 'A',
      brand: 'Sekar Pizza' as const,
      channel: 'IG',
      date: '2026-12-01',
      status: 'Ide' as const
    };
    const added = addPlan([], base);
    expect(added).toHaveLength(1);
    const updated = setPlanStatus(added, 'P1', 'Terbit');
    expect(updated[0].status).toBe('Terbit');
    expect(added[0].status).toBe('Ide');
    expect(removePlan(added, 'P1')).toHaveLength(0);
    expect(filterPlans(added, 'Sekar Pizza')).toHaveLength(1);
    expect(filterPlans(added, 'Suburbuns')).toHaveLength(0);
    expect(filterPlans(added, ALL_BRANDS)).toHaveLength(1);
  });
});
