import { describe, it, expect } from 'vitest';
import { isAllowedRole, scopeFor, type Actor } from './actor.js';

function actor(role: string, brandId = '', outletId = ''): Actor {
  return { userId: 'U', role, brandId, outletId, employeeId: 'E' };
}

describe('isAllowedRole', () => {
  it('allows owner and department heads', () => {
    for (const r of ['owner', 'super_admin', 'hr_admin', 'finance_admin', 'brand_manager', 'outlet_manager', 'supervisor']) {
      expect(isAllowedRole(r)).toBe(true);
    }
  });

  it('rejects employee and viewer', () => {
    expect(isAllowedRole('employee')).toBe(false);
    expect(isAllowedRole('viewer')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isAllowedRole('OWNER')).toBe(true);
  });
});

describe('scopeFor', () => {
  it('global roles have empty scope', () => {
    for (const r of ['owner', 'super_admin', 'hr_admin', 'finance_admin']) {
      expect(scopeFor(actor(r, 'BR-001', 'OL-001'))).toEqual({});
    }
  });

  it('brand_manager scopes to brand', () => {
    expect(scopeFor(actor('brand_manager', 'BR-001', 'OL-001'))).toEqual({ brandId: 'BR-001' });
  });

  it('outlet_manager scopes to outlet', () => {
    expect(scopeFor(actor('outlet_manager', 'BR-001', 'OL-001'))).toEqual({ outletId: 'OL-001' });
  });

  it('supervisor scopes to outlet', () => {
    expect(scopeFor(actor('supervisor', 'BR-001', 'OL-002'))).toEqual({ outletId: 'OL-002' });
  });

  it('outlet_manager without outlet falls back to brand', () => {
    expect(scopeFor(actor('outlet_manager', 'BR-001', ''))).toEqual({ brandId: 'BR-001' });
  });
});
