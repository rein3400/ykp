import { describe, expect, it } from 'vitest';
import { opsMenuText, validateIncidentCommand, opsDeepLink } from './ops-telegram';

describe('ops telegram menu', () => {
  it('lists every operational menu and gives each a web deep-link', () => {
    const text = opsMenuText('https://ops.example');
    for (const label of ['Opening', 'Closing', 'Briefing', 'KDS', 'QC', 'Insiden', 'Waste', 'Stock Issue']) {
      expect(text).toContain(label);
    }
    expect(text).toContain('https://ops.example/ops/incidents');
  });
});

describe('validateIncidentCommand', () => {
  it('accepts a minimal report and defaults severity/type', () => {
    expect(validateIncidentCommand({ title: 'AC bocor' })).toEqual({
      title: 'AC bocor', incident_type: 'OPERATIONAL', severity: 'MEDIUM'
    });
  });
  it('rejects an empty title and invalid severity/type', () => {
    expect(() => validateIncidentCommand({ title: '   ' })).toThrow();
    expect(() => validateIncidentCommand({ title: 'x', severity: 'URGENT' })).toThrow();
    expect(() => validateIncidentCommand({ title: 'x', incident_type: 'NOPE' })).toThrow();
  });
});

describe('opsDeepLink', () => {
  it('joins base url and path safely', () => {
    expect(opsDeepLink('https://ops.example/', '/ops/closing')).toBe('https://ops.example/ops/closing');
  });
});
