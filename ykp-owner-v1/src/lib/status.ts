/**
 * Module freshness computation — pure functions, vitest-covered.
 */
import type { ModuleStatus } from './types';

/**
 * Decide tile status from reachability + the latest summary date.
 * - mock:    caller already knows data is mocked
 * - offline: module could not be reached
 * - fresh:   latest summary date === today (WIB)
 * - stale:   reachable but summary missing or older than today
 */
export function computeModuleStatus(input: {
  mock: boolean;
  reachable: boolean;
  summaryDate: string | null;
  today: string;
}): ModuleStatus {
  if (input.mock) return 'mock';
  if (!input.reachable) return 'offline';
  if (input.summaryDate && input.summaryDate === input.today) return 'fresh';
  return 'stale';
}

export const STATUS_DOT: Record<ModuleStatus, string> = {
  fresh: 'bg-success',
  stale: 'bg-warning',
  offline: 'bg-destructive',
  mock: 'bg-gray-400'
};

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  fresh: 'Live',
  stale: 'Stale',
  offline: 'Offline',
  mock: 'Mock'
};

/** Latest YYYY-MM-DD in a set of rows' `date` column; null when none. */
export function latestSummaryDate(rows: { date?: string }[]): string | null {
  let latest: string | null = null;
  for (const r of rows) {
    const d = r.date;
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && (!latest || d > latest)) latest = d;
  }
  return latest;
}
