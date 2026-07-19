/**
 * Single source of truth for the LOCAL YKP app family.
 *
 * Base URLs default to the local dev ports and can be overridden with
 * NEXT_PUBLIC_YKP_*_URL env vars (see .env.example) — e.g. to point the hub
 * back at the Railway deployments later. NEXT_PUBLIC_* is required because
 * the registry is consumed by client components (app launcher cards) as
 * well as the server-side /api/health probe.
 *
 * Health probes: every Sheets app exposes a PUBLIC summary count endpoint
 * (GET /api/<module>/summary/count → { data: { count, ... } }). The owner
 * dashboard (3010) has no count endpoint, so it is probed at /login for
 * reachability instead.
 */

export interface HubModuleDef {
  id: string;
  name: string;
  desc: string;
  envVar: string;
  defaultUrl: string;
  /** Public probe path (count endpoint, or /login when none exists). */
  probePath: string;
  /** True when probePath returns { data: { count | total } }. */
  probeReturnsCount: boolean;
}

export const HUB_MODULES = [
  {
    id: "owner",
    name: "Owner Command",
    desc: "Cross-module read-only overview",
    envVar: "NEXT_PUBLIC_YKP_OWNER_URL",
    defaultUrl: "http://localhost:3010",
    probePath: "/login",
    probeReturnsCount: false
  },
  {
    id: "hr",
    name: "HR",
    desc: "Attendance, employees, roster",
    envVar: "NEXT_PUBLIC_YKP_HR_URL",
    defaultUrl: "http://localhost:3002",
    probePath: "/api/hr/summary/count",
    probeReturnsCount: true
  },
  {
    id: "finance",
    name: "Finance",
    desc: "POS, expenses, petty cash, daily summary",
    envVar: "NEXT_PUBLIC_YKP_FINANCE_URL",
    defaultUrl: "http://localhost:3003",
    probePath: "/api/finance/summary/count",
    probeReturnsCount: true
  },
  {
    id: "warehouse",
    name: "Warehouse",
    desc: "Stock, receiving, usage, waste",
    envVar: "NEXT_PUBLIC_YKP_WAREHOUSE_URL",
    defaultUrl: "http://localhost:3005",
    probePath: "/api/warehouse/summary/count",
    probeReturnsCount: true
  },
  {
    id: "investor",
    name: "Investor",
    desc: "Portfolio, capital, dividends",
    envVar: "NEXT_PUBLIC_YKP_INVESTOR_URL",
    defaultUrl: "http://localhost:3006",
    probePath: "/api/investor/summary/count",
    probeReturnsCount: true
  },
  {
    id: "ops",
    name: "Ops",
    desc: "Daily operations, incidents, actions",
    envVar: "NEXT_PUBLIC_YKP_OPS_URL",
    defaultUrl: "http://localhost:3007",
    probePath: "/api/ops/summary/count",
    probeReturnsCount: true
  }
] as const satisfies readonly HubModuleDef[];

export type HubModuleId = (typeof HUB_MODULES)[number]["id"];

export function findHubModule(id: string): HubModuleDef | undefined {
  return HUB_MODULES.find((m) => m.id === id);
}

/** Env-overridden base URL (no trailing slash). */
export function moduleBaseUrl(def: HubModuleDef): string {
  return (process.env[def.envVar] ?? def.defaultUrl).replace(/\/+$/, "");
}

/** Full URL the health probe should hit for this module. */
export function moduleProbeUrl(def: HubModuleDef): string {
  return `${moduleBaseUrl(def)}${def.probePath}`;
}
