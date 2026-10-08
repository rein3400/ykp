import { describe, expect, it } from 'vitest';
import { opsMenuText, validateIncidentCommand, opsDeepLink, routeOpsUpdate } from './ops-telegram';

describe('routeOpsUpdate', () => {
  it('routes menu/help/start and empty text to the menu', () => {
    for (const t of ['/start', '/menu', '/help', '', '  ']) expect(routeOpsUpdate(t).kind).toBe('menu');
  });
  it('routes /briefing and /insiden TEXT', () => {
    expect(routeOpsUpdate('/briefing').kind).toBe('briefing');
    expect(routeOpsUpdate('/insiden AC bocor di kitchen')).toEqual({ kind: 'incident', text: 'AC bocor di kitchen' });
    expect(routeOpsUpdate('/insiden')).toEqual({ kind: 'incident', text: '' });
  });
  it('routes a valid link code and uppercases it', () => {
    expect(routeOpsUpdate('/link abc234')).toEqual({ kind: 'link', code: 'ABC234' });
  });
  it('treats anything else as unknown', () => {
    expect(routeOpsUpdate('halo').kind).toBe('unknown');
    expect(routeOpsUpdate('/link nope').kind).toBe('unknown');
  });
});

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
