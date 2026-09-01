/**
 * Registry of the sibling YKP modules. Base URLs come from env so the same
 * build works local / LAN / Railway. Deep links point at each module's own
 * pages — the owner app never embeds module mutations (read-only doctrine).
 */
import type { ModuleKey } from './types';

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  envVar: string;
  defaultUrl: string;
  /** Public HTTPS base URL for client-side deep links (distinct from internal fetch URL). */
  publicUrl: string;
  /** Public GET paths (relative to base URL). */
  summaryPath: string;
  countPath: string | null;
  alertsPath: string | null;
  actionsPath: string | null;
  purchasePath: string | null;
  /** Public GET audit-trail path (owner activity feed). */
  auditPath: string;
  /** Public GET item-level POS sales path (finance only, null elsewhere). */
  posItemsPath: string | null;
  /** Public GET photo/document attachments path (null when module has none). */
  attachmentsPath: string | null;
  /** Public GET recipe theoretical costs path (warehouse only, null elsewhere). */
  recipeCostsPath: string | null;
  /** In-module pages for deep linking. */
  pages: {
    home: string;
    summary: string;
    alerts: string;
    actions: string;
  };
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  finance: {
    key: 'finance',
    label: 'Keuangan',
    envVar: 'YKP_FINANCE_URL',
    defaultUrl: 'http://localhost:3003',
    publicUrl: 'https://finance.oseedigital.tech',
    summaryPath: '/api/finance/summary',
    countPath: '/api/finance/summary/count',
    alertsPath: '/api/finance/alerts',
    actionsPath: '/api/finance/actions',
    purchasePath: null,
    auditPath: '/api/finance/audit',
    posItemsPath: '/api/finance/pos/items',
    attachmentsPath: null,
    recipeCostsPath: null,
    pages: { home: '/finance', summary: '/finance/summary', alerts: '/finance/alerts', actions: '/finance/actions' }
  },
  hr: {
    key: 'hr',
    label: 'SDM',
    envVar: 'YKP_HR_URL',
    defaultUrl: 'http://localhost:3002',
    publicUrl: 'https://hr.oseedigital.tech',
    summaryPath: '/api/hr/summary?date=TODAY',
    countPath: '/api/hr/summary/count',
    alertsPath: null,
    actionsPath: null,
    purchasePath: null,
    auditPath: '/api/hr/audit',
    posItemsPath: null,
    attachmentsPath: null,
    recipeCostsPath: null,
    pages: { home: '/hr', summary: '/hr/summary', alerts: '/hr/attendance', actions: '/hr/lateness' }
  },
  warehouse: {
    key: 'warehouse',
    label: 'Gudang',
    envVar: 'YKP_WAREHOUSE_URL',
    defaultUrl: 'http://localhost:3005',
    publicUrl: 'https://warehouse.oseedigital.tech',
    summaryPath: '/api/warehouse/summary',
    countPath: '/api/warehouse/summary/count',
    alertsPath: '/api/warehouse/alerts',
    actionsPath: '/api/warehouse/actions',
    purchasePath: '/api/warehouse/purchase-recommendation',
    auditPath: '/api/warehouse/audit',
    posItemsPath: null,
    attachmentsPath: '/api/warehouse/attachments',
    recipeCostsPath: '/api/warehouse/recipe-costs',
    pages: { home: '/warehouse', summary: '/warehouse/summary', alerts: '/warehouse/alerts', actions: '/warehouse/actions' }
  },
  ops: {
    key: 'ops',
    label: 'Operasional',
    envVar: 'YKP_OPS_URL',
    defaultUrl: 'http://localhost:3007',
    publicUrl: 'https://ops.oseedigital.tech',
    summaryPath: '/api/ops/summary',
    countPath: '/api/ops/summary/count',
    alertsPath: '/api/ops/alerts',
    actionsPath: '/api/ops/actions',
    purchasePath: null,
    auditPath: '/api/ops/audit',
    posItemsPath: null,
    attachmentsPath: '/api/ops/attachments',
    recipeCostsPath: null,
    pages: { home: '/ops', summary: '/ops/summary', alerts: '/ops/incidents', actions: '/ops/actions' }
  },
  investor: {
    key: 'investor',
    label: 'Investor',
    envVar: 'YKP_INVESTOR_URL',
    defaultUrl: 'http://localhost:3006',
    publicUrl: 'https://investor.oseedigital.tech',
    summaryPath: '/api/investor/summary',
    countPath: '/api/investor/summary/count',
    alertsPath: null,
    actionsPath: null,
    purchasePath: null,
    auditPath: '/api/investor/audit',
    posItemsPath: null,
    attachmentsPath: '/api/investor/attachments',
    recipeCostsPath: null,
    pages: { home: '/investor', summary: '/investor/portfolio', alerts: '/investor/portfolio', actions: '/investor/dividend' }
  }
};

export function moduleBaseUrl(def: ModuleDef): string {
  return (process.env[def.envVar] ?? def.defaultUrl).replace(/\/$/, '');
}

export function moduleUrl(def: ModuleDef, path: string): string {
  return `${moduleBaseUrl(def)}${path}`;
}

export function modulePublicUrl(def: ModuleDef, path: string): string {
  return `${(def.publicUrl || moduleBaseUrl(def)).replace(/\/$/, '')}${path}`;
}
