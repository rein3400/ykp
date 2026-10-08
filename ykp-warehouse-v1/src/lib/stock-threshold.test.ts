import { describe, expect, it } from 'vitest';
import { stockAlertLevel, thresholdRecipient } from './stock-threshold';

describe('stock threshold evaluation', () => {
  it('flags LOW at/below the warning floor and OVER at/above the high ceiling', () => {
    expect(stockAlertLevel(4, { warning_value: '5', high_value: '100' })).toBe('LOW');
    expect(stockAlertLevel(5, { warning_value: '5', high_value: '100' })).toBe('LOW');
    expect(stockAlertLevel(50, { warning_value: '5', high_value: '100' })).toBeNull();
    expect(stockAlertLevel(100, { warning_value: '5', high_value: '100' })).toBe('OVER');
  });
  it('treats the higher of warning/critical as the low floor', () => {
    expect(stockAlertLevel(8, { warning_value: '5', critical_value: '10' })).toBe('LOW');
    expect(stockAlertLevel(12, { warning_value: '5', critical_value: '10' })).toBeNull();
  });
  it('is inert without finite numbers', () => {
    expect(stockAlertLevel(1, {})).toBeNull();
    expect(stockAlertLevel(1, { warning_value: 'abc' })).toBeNull();
    expect(stockAlertLevel(Number.NaN, { warning_value: '5' })).toBeNull();
  });
  it('returns the configured recipient or empty when unset', () => {
    expect(thresholdRecipient({ notify_recipient: 'role:supervisor' })).toBe('role:supervisor');
    expect(thresholdRecipient({})).toBe('');
  });
});
