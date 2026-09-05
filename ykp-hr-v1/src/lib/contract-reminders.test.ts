import { describe, it, expect } from 'vitest';
import {
  addMonths,
  diffDays,
  contractReminders,
  composeReminderText
} from './contract-reminders';

describe('contract-reminders (MOM 1 Sep 2026 §2)', () => {
  it('addMonths clamps end-of-month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-07-15', 2)).toBe('2026-09-15');
    expect(addMonths('2026-09-01', 14)).toBe('2027-11-01');
    expect(addMonths('not-a-date', 2)).toBeNull();
  });

  it('diffDays counts calendar days', () => {
    expect(diffDays('2026-09-01', '2026-09-08')).toBe(7);
    expect(diffDays('2026-09-08', '2026-09-01')).toBe(-7);
    expect(diffDays('2026-09-01', '2026-09-01')).toBe(0);
  });

  it('reminds PROBATION staff inside the warning window', () => {
    // join 2026-07-10 → probation ends 2026-09-10; today 2026-09-01 = H-9
    const out = contractReminders(
      [{ employee_id: 'EMP-1', full_name: 'Satu', join_date: '2026-07-10', employment_status: 'PROBATION' }],
      '2026-09-01'
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('PROBATION_END');
    expect(out[0].dueDate).toBe('2026-09-10');
    expect(out[0].daysLeft).toBe(9);
    expect(out[0].overdue).toBe(false);
  });

  it('reminds CONTRACT staff against the 14-month total', () => {
    // join 2026-09-20 → contract ends 2027-11-20; today 2027-11-10 = H-10
    const out = contractReminders(
      [{ employee_id: 'EMP-2', full_name: 'Dua', join_date: '2026-09-20', employment_status: 'KONTRAK' }],
      '2027-11-10'
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('CONTRACT_END');
    expect(out[0].dueDate).toBe('2027-11-20');
  });

  it('flags overdue inside grace, skips far-future and permanent staff', () => {
    const out = contractReminders(
      [
        { employee_id: 'EMP-3', full_name: 'Tiga', join_date: '2026-06-25', employment_status: 'PROBATION' }, // due 08-25, -7
        { employee_id: 'EMP-4', full_name: 'Empat', join_date: '2026-08-01', employment_status: 'PROBATION' }, // due 10-01, +30
        { employee_id: 'EMP-5', full_name: 'Lima', join_date: '2020-01-01', employment_status: 'PERMANENT' },
        { employee_id: 'EMP-6', full_name: 'Enam', join_date: '', employment_status: 'PROBATION' }
      ],
      '2026-09-01'
    );
    expect(out.map((r) => r.employee_id)).toEqual(['EMP-3']);
    expect(out[0].overdue).toBe(true);
  });

  it('composes a readable Telegram body', () => {
    const text = composeReminderText('2026-09-01', [
      { employee_id: 'EMP-1', full_name: 'Satu', kind: 'PROBATION_END', dueDate: '2026-09-10', daysLeft: 9, overdue: false }
    ]);
    expect(text).toContain('Satu');
    expect(text).toContain('2026-09-10');
    expect(text).toContain('H-9');
  });
});
