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

export const SILVER_BULLET_WINDOWS = {
  'AM_SB': { label: 'Asian Silver Bullet', start: '20:00', end: '22:00' },
  'LDN_SB': { label: 'London Silver Bullet', start: '03:00', end: '05:00' },
  'NY_SB': { label: 'New York Silver Bullet', start: '10:00', end: '12:00' }
} as const;

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
  SILVER_BULLET_TIME: 'SILVER_BULLET_TIME'
} as const;

export type Signal = typeof SIGNALS[keyof typeof SIGNALS];

// HERMES — Knowledge base categories (24 from brief)
export const KNOWLEDGE_CATEGORIES = [
  'ICT Foundation', 'Market Structure', 'Liquidity', 'PD Array', 'FVG', 'IFVG', 'MSS', 'BOS',
  'Order Block', 'Breaker', 'Mitigation', 'Turtle Soup', 'Silver Bullet', 'Judas Swing',
  'SMT', 'DOL', 'MDO', 'TDO', 'Kill Zone', 'News', 'Risk Management', 'Psychology',
  'Funding Rules', 'Journal', 'SOP Sri ICT', 'Strategy Improvement'
] as const;
export type KnowledgeCategory = typeof KNOWLEDGE_CATEGORIES[number];

// Scoring rubric weights — single source of truth (sum=100)
export const SCORING_WEIGHTS = {
  biasAlign: 20,
  sweep: 15,
  mss: 20,
  ifvg: 20,
  session: 10,
  newsClear: 10,
  smt: 5
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