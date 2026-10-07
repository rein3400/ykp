import { describe, expect, it } from 'vitest';
import { fixedConversionFactor, validateConversionFactor } from './unit-conversion';

describe('physical conversion factors', () => {
  it.each([
    ['kg', 'gram', 1000], ['gr', 'kg', 0.001],
    ['liter', 'ml', 1000], ['ml', 'l', 0.001],
    ['KG', 'kilogram', 1], [' g ', 'gr', 1]
  ])('%s to %s has factor %s', (from, to, expected) => {
    expect(fixedConversionFactor(from, to)).toBe(expected);
  });
  it.each([['kg', 'ml'], ['box', 'g'], ['roll', 'karton']])('keeps %s to %s manual', (from, to) => {
    expect(fixedConversionFactor(from, to)).toBeNull();
  });
  it.each(['NaN', 'Infinity', '', '0', '-1', undefined, null, true])('rejects invalid factor %s', (value) => {
    expect(() => validateConversionFactor('box', 'g', value)).toThrow();
  });
  it('rejects incorrect fixed factors and accepts valid manual packaging', () => {
    expect(() => validateConversionFactor('kg', 'g', '10000')).toThrow();
    expect(validateConversionFactor('kg', 'g', '1000')).toBe(1000);
    expect(validateConversionFactor('box', 'g', '250')).toBe(250);
  });
});
