/**
 * Shared types for the owner aggregation layer.
 * The owner app is READ-ONLY: it normalizes the sibling modules' public
 * summary/alert/action endpoints into one OwnerOverview. It never writes
 * back to any module (Hermez no-write-back doctrine).
 */

export type ModuleKey = 'finance' | 'hr' | 'warehouse' | 'ops' | 'investor';

export const MODULE_KEYS: ModuleKey[] = ['finance', 'hr', 'warehouse', 'ops', 'investor'];

/** Raw sheet row as returned by every module summary endpoint. */
export type SummaryRow = Record<string, string>;

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Module freshness:
 * - fresh:   summary rows exist for today (WIB)
 * - stale:   module reachable but summary missing/older than today
 * - offline: module unreachable / erroring
 * - mock:    data comes from the built-in mock dataset
 */
export type ModuleStatus = 'fresh' | 'stale' | 'offline' | 'mock';

export interface OwnerAlert {
  id: string;
  module: ModuleKey;
  severity: Severity;
  brand: string;
  outlet: string;
  title: string;
  message: string;
  /** ISO/WIB timestamp string for display + sorting; '' when unknown. */
  time: string;
  status: string;
  /** Absolute URL into the owning module's alert page. */
  deepLink: string;
}

export interface OwnerAction {
  id: string;
  module: ModuleKey;
  title: string;
  brand: string;
  outlet: string;
  pic: string;
  dueDate: string;
  status: string;
  overdue: boolean;
  deepLink: string;
}

export interface ModuleResult {
  key: ModuleKey;
  label: string;
  status: ModuleStatus;
  reachable: boolean;
  latencyMs: number | null;
  /** Latest summary date found (YYYY-MM-DD) or null. */
  summaryDate: string | null;
  rows: SummaryRow[];
  /** Record count from /summary/count, null when unavailable. */
  recordCount: number | null;
  alerts: OwnerAlert[];
  /** True when the module exposes an alerts endpoint but it failed. */
  alertsUnavailable: boolean;
  actions: OwnerAction[];
  purchaseRecs: SummaryRow[];
  error: string | null;
  /** Module home deep link. */
  deepLink: string;
}

export interface Headline {
  /** Sum of estimated_surplus across finance rows. NEVER called "net profit". */
  estimasiSurplusKas: number;
  revenueToday: number;
  revenue7dAvg: number | null;
  expenseToday: number;
  unpaidSupplier: number;
  staffPresent: number;
  staffLate: number;
  staffAbsent: number;
  criticalStockCount: number;
  openHighCriticalIncidents: number;
  cashPosition: number;
}

export interface OwnerOverview {
  /** YYYY-MM-DD (WIB) the overview was generated for. */
  date: string;
  generatedAt: string;
  mock: boolean;
  /** True when mock was forced by env; false when auto-fallback. */
  mockForced: boolean;
  modules: Record<ModuleKey, ModuleResult>;
  alerts: OwnerAlert[];
  actions: OwnerAction[];
  headline: Headline;
}

export interface BriefResult {
  text: string;
  alertLevel: 'green' | 'yellow' | 'red';
  alertCount: number;
}
