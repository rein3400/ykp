import { describe, it, expect } from 'vitest';
import { parseAbsenIntent, escapeHtml } from './telegram-attendance';

describe('parseAbsenIntent', () => {
  it('recognizes clock-in commands', () => {
    expect(parseAbsenIntent('/masuk')).toBe('clock-in');
    expect(parseAbsenIntent('/absen')).toBe('clock-in');
    expect(parseAbsenIntent('/clock_in')).toBe('clock-in');
  });

  it('recognizes clock-out commands', () => {
    expect(parseAbsenIntent('/pulang')).toBe('clock-out');
    expect(parseAbsenIntent('/clockout')).toBe('clock-out');
  });

  it('recognizes help commands', () => {
    expect(parseAbsenIntent('/start')).toBe('help');
    expect(parseAbsenIntent('/bantuan')).toBe('help');
  });

  it('returns unknown for empty/unrecognized text', () => {
    expect(parseAbsenIntent(undefined)).toBe('unknown');
    expect(parseAbsenIntent('halo')).toBe('unknown');
  });
});

describe('escapeHtml', () => {
  it('escapes Telegram HTML special characters', () => {
    expect(escapeHtml('<b>&"</b>')).toBe('&lt;b&gt;&amp;&quot;&lt;/b&gt;');
  });
});
