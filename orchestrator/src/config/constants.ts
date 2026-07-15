import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TIMEZONE = 'Asia/Jakarta';
export const WIB_OFFSET = '+07:00';

export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  FINANCE: 'finance',
  HR: 'hr',
  STAFF: 'staff',
  TRADER: 'trader'
} as const;

export const COMMAND_PERMISSIONS: Record<string, readonly string[]> = {
  '/status': [ROLES.OWNER, ROLES.MANAGER, ROLES.FINANCE, ROLES.HR, ROLES.STAFF, ROLES.TRADER],
  '/omzet': [ROLES.OWNER, ROLES.MANAGER, ROLES.FINANCE],
  '/report': [ROLES.OWNER, ROLES.MANAGER],
  '/hr': [ROLES.OWNER, ROLES.MANAGER, ROLES.HR],
  '/finance': [ROLES.OWNER, ROLES.MANAGER, ROLES.FINANCE],
  '/sop': [ROLES.OWNER, ROLES.MANAGER, ROLES.FINANCE, ROLES.HR, ROLES.STAFF, ROLES.TRADER],
  '/trading': [ROLES.OWNER, ROLES.TRADER],
  '/journal': [ROLES.OWNER, ROLES.TRADER],
  '/memory': [ROLES.OWNER, ROLES.MANAGER],
  '/signals': [ROLES.OWNER, ROLES.TRADER],
  '/knowledge': [ROLES.OWNER, ROLES.MANAGER, ROLES.TRADER],
  '/help': [ROLES.OWNER, ROLES.MANAGER, ROLES.FINANCE, ROLES.HR, ROLES.STAFF, ROLES.TRADER]
};

/**
 * Kill Zone + Silver Bullet windows in Asia/Jakarta (WIB = UTC+7, no DST).
 * Derived from ICT_TRADING_STRATEGY.md §6 (UTC Kill Zones):
 *   London KZ 02:00–05:00 UTC → 09:00–12:00 WIB
 *   NY KZ     07:00–10:00 UTC → 14:00–17:00 WIB
 * Silver Bullet sub-windows (1H ICT SB) nested inside KZ for setup labeling.
 */
export const KILL_ZONE_WINDOWS = {
  LDN_KZ: { label: 'London Kill Zone', start: '09:00', end: '12:00' },
  NY_KZ: { label: 'New York Kill Zone', start: '14:00', end: '17:00' },
  LDN_SB: { label: 'London Silver Bullet', start: '10:00', end: '11:00' },
  NY_SB: { label: 'New York Silver Bullet', start: '15:00', end: '16:00' },
  // Asian range reference only — not a trade window under strict mode
  AM_SB: { label: 'Asia reference (no entry)', start: '20:00', end: '22:00', tradeable: false as const }
} as const;

/** @deprecated use KILL_ZONE_WINDOWS — kept alias for older imports */
export const SILVER_BULLET_WINDOWS = KILL_ZONE_WINDOWS;

export const SIGNALS = {
  HTF_BIAS_BULL: 'HTF_BIAS_BULL',
  HTF_BIAS_BEAR: 'HTF_BIAS_BEAR',
  DOL_BUY: 'DOL_BUY',
  DOL_SELL: 'DOL_SELL',
  SWEEP_SSL: 'SWEEP_SSL',
  SWEEP_BSL: 'SWEEP_BSL',
  MSS_BULL: 'MSS_BULL',
  MSS_BEAR: 'MSS_BEAR',
  IFVG_BULL: 'IFVG_BULL',
  IFVG_BEAR: 'IFVG_BEAR',
  SMT_BULL: 'SMT_BULL',
  SMT_BEAR: 'SMT_BEAR',
  SILVER_BULLET_TIME: 'SILVER_BULLET_TIME',
  // Optional structure labels from chart (not required for entry)
  PD_PREMIUM: 'PD_PREMIUM',
  PD_DISCOUNT: 'PD_DISCOUNT',
  PD_ARRAY_OB: 'PD_ARRAY_OB',
  PD_ARRAY_BREAKER: 'PD_ARRAY_BREAKER',
  PD_ARRAY_FVG: 'PD_ARRAY_FVG'
} as const;

export type Signal = (typeof SIGNALS)[keyof typeof SIGNALS];

// HERMES — Knowledge base categories (24 from brief)
export const KNOWLEDGE_CATEGORIES = [
  'ICT Foundation',
  'Market Structure',
  'Liquidity',
  'PD Array',
  'FVG',
  'IFVG',
  'MSS',
  'BOS',
  'Order Block',
  'Breaker',
  'Mitigation',
  'Turtle Soup',
  'Silver Bullet',
  'Judas Swing',
  'SMT',
  'DOL',
  'MDO',
  'TDO',
  'Kill Zone',
  'News',
  'Risk Management',
  'Psychology',
  'Funding Rules',
  'Journal',
  'SOP Sri ICT',
  'Strategy Improvement'
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

/**
 * Scoring rubric — ICT_TRADING_STRATEGY.md §4 (sum = 100).
 * Hard gates (Sweep/MSS/IFVG/News/Session) reject BEFORE scoring;
 * these weights grade quality of a setup that already passed gates.
 */
export const SCORING_WEIGHTS = {
  htfAlign: 25,
  sweep: 15,
  mss: 15,
  ifvg: 15,
  rr: 15,
  session: 10,
  newsClear: 5
} as const;

/** Risk hard limits — ICT_TRADING_STRATEGY.md §8 */
export const RISK_LIMITS = {
  MIN_RR: 3,
  MAX_RISK_PCT_PER_TRADE: 2,
  MAX_DAILY_LOSS_PCT: 5,
  MAX_OPEN_TRADES: 3,
  /** Score ≥ this may use full 1–2% risk; below uses reduced risk. */
  FULL_RISK_SCORE: 90
} as const;

// 5 HERMES agents — taskType maps to ai-router
export const AGENT_TASK_TYPES = {
  ict_mentor: 'ict_mentor',
  news_analyst: 'news_analyst',
  risk_manager: 'risk_manager',
  trade_auditor: 'trade_auditor',
  psychology_coach: 'psychology_coach'
} as const;
export type AgentId = keyof typeof AGENT_TASK_TYPES;

// Resolve Hermes_Knowledge root relative to orchestrator/ for both runtime + tsx
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const KNOWLEDGE_ROOT = path.resolve(__dirname, '../../../Hermes_Knowledge');
