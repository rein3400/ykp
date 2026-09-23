export type EmploymentStatus = 'PROBATION' | 'CONTRACT' | 'PERMANENT';

export interface ContractTimeline {
  joinDate: string;
  probationEndDate: string;
  contractStartDate: string;
  contractEndDate: string;
  permanentEligibleDate: string;
  currentPhase: EmploymentStatus;
  probationDaysTotal: number;
  probationDaysRemaining: number;
  contractDaysTotal: number;
  contractDaysRemaining: number;
  totalDaysToPermanent: number;
}

/**
 * Parse a date-only "YYYY-MM-DD" string into a Date at UTC midnight.
 *
 * Date-only arithmetic must be timezone-independent: the previous
 * implementation built `new Date(s + 'T00:00:00+07:00')` (WIB midnight)
 * but all consumers read it back with UTC getters / toISOString(),
 * shifting every date back by one day (e.g. join 2024-01-10 produced
 * probation end 2024-03-09 instead of 2024-03-10, and the +1-day
 * contract-start step was swallowed entirely).
 *
 * Strict validation: rejects malformed strings AND calendar overflow
 * (e.g. 2024-02-30, which the Date constructor silently rolls over).
 */
function parseDate(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));
  if (m < 1 || m > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(y, m - 1, day));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== day) return null;
  return d;
}

function diffDays(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

/** Format a UTC-midnight date back to "YYYY-MM-DD" (no timezone shift possible). */
function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addMonths(dateStr: string, months: number): string {
  const d = parseDate(dateStr);
  if (!d) return '';
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const nd = new Date(Date.UTC(y, m + months, day));
  if (nd.getUTCDate() !== day) {
    nd.setUTCDate(0);
  }
  return formatDate(nd);
}

function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  if (!d) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

/** WIB calendar date "YYYY-MM-DD" for an instant, host-TZ independent. */
function wibDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function computeTimeline(
  joinDate: string,
  employmentStatus: string,
  todayStr?: string,
  overrides?: { probationEndDate?: string; contractStartDate?: string; contractEndDate?: string }
): ContractTimeline | null {
  const join = parseDate(joinDate);
  if (!join) return null;
  // Explicit invalid overrides must fail loudly (return null) instead of
  // silently driving probation/contract math with rolled-over dates.
  // Empty string / undefined means "absent" and falls back to policy below
  // (keeps getReminderCandidates working when columns are blank).
  if (overrides) {
    for (const v of [overrides.probationEndDate, overrides.contractStartDate, overrides.contractEndDate]) {
      if (v !== undefined && v !== '' && !parseDate(v)) return null;
    }
  }
  // Old code round-tripped through `new Date(today.toLocaleString(...))`,
  // which parses WIB wall time as *host-local* time — host-TZ dependent.
  // Intl with explicit Asia/Jakarta is deterministic on any host.
  const today = todayStr ? parseDate(todayStr) ?? new Date() : new Date();
  const todayDate = parseDate(wibDateString(today)) ?? today;

  // Policy (UNCHANGED): 2-month probation, contract starts day after
  // probation ends, 12-month contract, permanent eligible day after end.
  const probationEnd = overrides?.probationEndDate || addMonths(joinDate, 2);
  const contractStart = overrides?.contractStartDate || (probationEnd ? addDays(probationEnd, 1) : '');
  const contractEnd = overrides?.contractEndDate || (contractStart ? addMonths(contractStart, 12) : '');
  if (!probationEnd || !contractStart || !contractEnd) return null;

  const probationEndDate = parseDate(probationEnd)!;
  const contractEndDate = parseDate(contractEnd)!;

  let currentPhase: EmploymentStatus = 'PROBATION';
  const statusUpper = (employmentStatus ?? '').toUpperCase();
  if (statusUpper === 'PERMANENT') currentPhase = 'PERMANENT';
  else if (statusUpper === 'CONTRACT') currentPhase = 'CONTRACT';
  else if (todayDate > contractEndDate) currentPhase = 'CONTRACT';
  else if (todayDate > probationEndDate) currentPhase = 'CONTRACT';

  const probationDaysTotal = diffDays(join, probationEndDate);
  const probationDaysRemaining = diffDays(todayDate, probationEndDate);
  const contractStartDate = parseDate(contractStart)!;
  const contractDaysTotal = diffDays(contractStartDate, contractEndDate);
  const contractDaysRemaining = diffDays(todayDate, contractEndDate);

  return {
    joinDate,
    probationEndDate: probationEnd,
    contractStartDate: contractStart,
    contractEndDate: contractEnd,
    permanentEligibleDate: addDays(contractEnd, 1),
    currentPhase,
    probationDaysTotal,
    probationDaysRemaining,
    contractDaysTotal,
    contractDaysRemaining,
    totalDaysToPermanent: diffDays(todayDate, parseDate(addDays(contractEnd, 1))!)
  };
}

export interface ReminderCandidate {
  employeeId: string;
  employeeName: string;
  brandId: string;
  outletId: string;
  joinDate: string;
  employmentStatus: string;
  kind: 'PROBATION_ENDING' | 'CONTRACT_ENDING';
  targetDate: string;
  daysRemaining: number;
}

export function getReminderCandidates(
  employees: Record<string, string>[],
  todayStr?: string
): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];
  for (const e of employees) {
    if ((e.active_status ?? '').toLowerCase() !== 'active') continue;
    const joinDate = e.join_date ?? '';
    if (!joinDate) continue;
    const tl = computeTimeline(joinDate, e.employment_status ?? '', todayStr, {
      probationEndDate: e.probation_end_date,
      contractStartDate: e.contract_start_date,
      contractEndDate: e.contract_end_date
    });
    if (!tl) continue;

    if (tl.currentPhase === 'PROBATION' || e.employment_status?.toUpperCase() === 'PROBATION') {
      const d = tl.probationDaysRemaining;
      if (d >= 0 && d <= 7) {
        out.push({
          employeeId: e.employee_id,
          employeeName: e.full_name,
          brandId: e.brand_id,
          outletId: e.outlet_id,
          joinDate,
          employmentStatus: e.employment_status,
          kind: 'PROBATION_ENDING',
          targetDate: tl.probationEndDate,
          daysRemaining: d
        });
      }
    }

    if (tl.currentPhase === 'CONTRACT' || e.employment_status?.toUpperCase() === 'CONTRACT') {
      const d = tl.contractDaysRemaining;
      if (d >= 0 && d <= 14) {
        out.push({
          employeeId: e.employee_id,
          employeeName: e.full_name,
          brandId: e.brand_id,
          outletId: e.outlet_id,
          joinDate,
          employmentStatus: e.employment_status,
          kind: 'CONTRACT_ENDING',
          targetDate: tl.contractEndDate,
          daysRemaining: d
        });
      }
    }
  }
  return out.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
