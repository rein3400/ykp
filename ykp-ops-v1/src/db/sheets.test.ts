import { describe, it, expect, vi } from 'vitest';
import { columnLetter, auditSheetHeaders, mapRowsByHeader, TABS, TAB_HEADERS } from './sheets';

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
describe('readTab header tolerance (mapRowsByHeader)', () => {
  it('ignores unknown sheet columns and still fills known fields by name', () => {
    // simulates a sheet with extra human columns (department/telegram_id) and a
    // reordered middle: field resolution must be by name, never by position.
    const headerRow = ['user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id', 'department', 'employee_id', 'telegram_id', 'active_status', 'created_at', 'last_login_at'];
    const dataRow = ['USR-001', 'owner', 'hash', 'owner', '', '', '', '', '', 'active', '2026-07-19', ''];
    const [obj] = mapRowsByHeader<Record<string, string>>(headerRow, [dataRow]);
    expect(obj.username).toBe('owner');
    expect(obj.active_status).toBe('active');
    expect(obj.password_hash).toBe('hash');
    expect(obj.department).toBe('');
    expect(obj.telegram_id).toBe('');
  });
});

describe('auditSheetHeaders', () => {
  it('flags missing + extra + misordered columns per tab', async () => {
    const fake = async (tab: string) => {
      if (tab === TABS.users) {
        return ['user_id', 'username', 'active_status', 'role', 'password_hash', 'brand_id', 'outlet_id', 'zzz_new', 'created_at'];
      }
      return (TAB_HEADERS as Record<string, string[]>)[tab];
    };
    const drift = await auditSheetHeaders(fake);
    expect(drift).toHaveLength(Object.keys(TABS).length);
    const users = drift.find((d) => d.tab === TABS.users)!;
    expect(users.extra).toContain('zzz_new');
    expect(users.missing).toContain('last_login_at');
    expect(users.misordered).toBe(true);
    const brands = drift.find((d) => d.tab === TABS.brands)!;
    expect(brands).toMatchObject({ missing: [], extra: [], misordered: false });
  });
});
