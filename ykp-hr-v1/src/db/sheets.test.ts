import { describe, it, expect } from 'vitest';
import { columnLetter } from './sheets';

describe('columnLetter helper', () => {
  it('maps A-Z for columns 1-26', () => {
    expect(columnLetter(1)).toBe('A');
    expect(columnLetter(26)).toBe('Z');
  });

  it('maps two-letter columns above 26', () => {
    expect(columnLetter(27)).toBe('AA');
    expect(columnLetter(28)).toBe('AB');
    expect(columnLetter(34)).toBe('AH'); // employees tab
    expect(columnLetter(35)).toBe('AI'); // payroll tab
  });

  it('maps three-letter columns', () => {
    expect(columnLetter(702)).toBe('ZZ');
    expect(columnLetter(703)).toBe('AAA');
  });
});