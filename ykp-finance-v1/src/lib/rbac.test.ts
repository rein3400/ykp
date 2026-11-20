import { describe, expect, it } from 'vitest';
import { can, scopeFilter } from './rbac';

describe('HR-synced role aliases', () => {
  it('lets employee accounts read expenses without granting writes', () => {
    expect(can('employee', 'view', 'expense')).toBe(true);
    expect(can('employee', 'create', 'expense')).toBe(false);
  });

  it('lets supervisor accounts read without granting writes', () => {
    expect(can('supervisor', 'view', 'expense')).toBe(true);
    expect(can('supervisor', 'create', 'expense')).toBe(false);
  });

  it('keeps employee scope read-only across all brands', () => {
    expect(scopeFilter('employee', 'BR-1', 'OL-1')).toEqual({});
  });
});
