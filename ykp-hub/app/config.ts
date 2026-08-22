/**
 * Single source of truth for the LOCAL YKP app family.
 *
 * NEXT_PUBLIC_* env vars are inlined at build time by Next.js.
 * Dynamic process.env[varName] does NOT get inlined, so we use
 * explicit per-variable access here.
 */

export interface HubModuleDef {
  id: string;
  name: string;
  desc: string;
  url: string;
  probePath: string;
  probeReturnsCount: boolean;
}

const VPS = "http://187.52.124.40";

export const HUB_MODULES: readonly HubModuleDef[] = [
  {
    id: "owner",
    name: "Owner Command",
    desc: "Cross-module read-only overview",
    url: process.env.NEXT_PUBLIC_YKP_OWNER_URL ?? `${VPS}:3010`,
    probePath: "/login",
    probeReturnsCount: false
  },
  {
    id: "hr",
    name: "HR",
    desc: "Attendance, employees, roster",
    url: process.env.NEXT_PUBLIC_YKP_HR_URL ?? `${VPS}:3002`,
    probePath: "/api/hr/summary/count",
    probeReturnsCount: true
  },
  {
    id: "finance",
    name: "Finance",
    desc: "POS, expenses, petty cash, daily summary",
    url: process.env.NEXT_PUBLIC_YKP_FINANCE_URL ?? `${VPS}:3003`,
    probePath: "/api/fin/summary",
    probeReturnsCount: false
  },
  {
    id: "warehouse",
    name: "Warehouse",
    desc: "Stock, receiving, usage, waste",
    url: process.env.NEXT_PUBLIC_YKP_WAREHOUSE_URL ?? `${VPS}:3005`,
    probePath: "/api/warehouse/summary",
    probeReturnsCount: false
  },
  {
    id: "investor",
    name: "Investor",
    desc: "Portfolio, capital, dividends",
    url: process.env.NEXT_PUBLIC_YKP_INVESTOR_URL ?? `${VPS}:3006`,
    probePath: "/api/investor/summary",
    probeReturnsCount: false
  },
  {
    id: "ops",
    name: "Ops",
    desc: "Daily operations, incidents, actions",
    url: process.env.NEXT_PUBLIC_YKP_OPS_URL ?? `${VPS}:3007`,
    probePath: "/api/ops/summary",
    probeReturnsCount: false
  }
];

export type HubModuleId = (typeof HUB_MODULES)[number]["id"];

export function findHubModule(id: string): HubModuleDef | undefined {
  return HUB_MODULES.find((m) => m.id === id);
}

/** Base URL (no trailing slash). */
export function moduleBaseUrl(def: HubModuleDef): string {
  return def.url.replace(/\/+$/, "");
}

/** Full URL the health probe should hit for this module. */
export function moduleProbeUrl(def: HubModuleDef): string {
  return `${moduleBaseUrl(def)}${def.probePath}`;
}
