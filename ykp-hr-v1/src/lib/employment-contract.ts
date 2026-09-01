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

function parseDate(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00+07:00');
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

export function computeTimeline(
  joinDate: string,
  employmentStatus: string,
  todayStr?: string,
  overrides?: { probationEndDate?: string; contractStartDate?: string; contractEndDate?: string }
): ContractTimeline | null {
  const join = parseDate(joinDate);
  if (!join) return null;
  const today = todayStr ? parseDate(todayStr) ?? new Date() : new Date();
  const todayWib = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const todayDate = parseDate(formatDate(todayWib)) ?? todayWib;

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