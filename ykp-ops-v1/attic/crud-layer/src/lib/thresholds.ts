/**
 * Threshold config reader. Reads ops_threshold_config and returns typed
 * thresholds with brief defaults as fallback. Outlet-scoped rows override
 * global (scope GLOBAL) rows.
 */
import { readTab, TABS } from '@/db/sheets';
import { DEFAULT_THRESHOLDS } from './alert-rules';

export interface EffectiveThresholds {
  checklistMinPct: number;
  checklistWarningPct: number;
  cashTolerance: number;
  wasteDailyLimit: number;
  wasteRepeatCount7d: number;
  servingTimeTargetSeconds: number;
  closingDeadlineTime: string; // HH:MM WIB
  qcMinScore: number;
}

const KEY_MAP: Record<string, keyof EffectiveThresholds> = {
  checklist_completion_min_pct: 'checklistMinPct',
  checklist_completion_warning_pct: 'checklistWarningPct',
  cash_difference_tolerance: 'cashTolerance',
  waste_daily_limit: 'wasteDailyLimit',
  waste_repeat_count_7d: 'wasteRepeatCount7d',
  serving_time_target_seconds: 'servingTimeTargetSeconds',
  closing_deadline_time: 'closingDeadlineTime',
  qc_min_score: 'qcMinScore'
};

export async function getThresholds(outletId?: string): Promise<EffectiveThresholds> {
  const rows = await readTab<Record<string, string>>(TABS.thresholdConfig);
  const result: EffectiveThresholds = {
    checklistMinPct: DEFAULT_THRESHOLDS.checklistMinPct,
    checklistWarningPct: DEFAULT_THRESHOLDS.checklistWarningPct,
    cashTolerance: DEFAULT_THRESHOLDS.cashTolerance,
    wasteDailyLimit: DEFAULT_THRESHOLDS.wasteDailyLimit,
    wasteRepeatCount7d: DEFAULT_THRESHOLDS.wasteRepeatCount7d,
    servingTimeTargetSeconds: 180,
    closingDeadlineTime: '23:30',
    qcMinScore: 4.0
  };
  const active = rows.filter((r) => r.active_status === 'active');
  // Global first, outlet-scoped overrides after
  const ordered = [
    ...active.filter((r) => r.scope !== 'OUTLET'),
    ...active.filter((r) => r.scope === 'OUTLET' && outletId && r.outlet_id === outletId)
  ];
  for (const r of ordered) {
    const key = KEY_MAP[r.threshold_key];
    if (!key) continue;
    if (key === 'closingDeadlineTime') {
      if (r.value) result[key] = r.value;
    } else {
      const n = Number(r.value);
      if (Number.isFinite(n)) (result[key] as number) = n;
    }
  }
  return result;
}

/** Is `time` (HH:MM) at/past the deadline, for a summary date vs today? */
export function closingDeadlinePassed(date: string, today: string, nowTime: string, deadline: string): boolean {
  if (date < today) return true;
  if (date > today) return false;
  return nowTime >= deadline;
}
