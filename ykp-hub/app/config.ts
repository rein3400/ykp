/**
 * Single source of truth for the YKP app family.
 *
 * Base URLs DEFAULT to production hosts (Railway/Vercel). Override with
 * NEXT_PUBLIC_YKP_*_URL for local dev (see .env.example). Production-first
 * defaults are intentional: Railway's Docker build does NOT inject service
 * env vars into `next build`, so NEXT_PUBLIC_* would otherwise be undefined
 * at build time and the client bundle would bake in localhost — wrong for
 * production. Hardcoding prod URLs as defaultUrl is the reliable path.
 *
 * Health probes: every Sheets app exposes a PUBLIC summary count endpoint
 * (GET /api/<module>/summary/count → { data: { count, ... } }). Hermez
 * has no count endpoint, so it is probed at /login for reachability.
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
    defaultUrl: "https://owner.oseedigital.tech",
    probePath: "/login",
    probeReturnsCount: false
  },
  {
    id: "hr",
    name: "HR",
    desc: "Attendance, employees, roster",
    envVar: "NEXT_PUBLIC_YKP_HR_URL",
    defaultUrl: "https://hr-v1.oseedigital.tech",
    probePath: "/api/hr/summary/count",
    probeReturnsCount: true
  },
  {
    id: "finance",
    name: "Finance",
    desc: "POS, expenses, petty cash, daily summary",
    envVar: "NEXT_PUBLIC_YKP_FINANCE_URL",
    defaultUrl: "https://finance-v1.oseedigital.tech",
    probePath: "/login",
    probeReturnsCount: false
  },
  {
    id: "warehouse",
    name: "Warehouse",
    desc: "Stock, receiving, usage, waste",
    envVar: "NEXT_PUBLIC_YKP_WAREHOUSE_URL",
    defaultUrl: "https://warehouse.oseedigital.tech",
    probePath: "/login",
    probeReturnsCount: false
  },
  {
    id: "investor",
    name: "Investor",
    desc: "Portfolio, capital, dividends",
    envVar: "NEXT_PUBLIC_YKP_INVESTOR_URL",
    defaultUrl: "https://investor.oseedigital.tech",
    probePath: "/api/investor/summary",
    probeReturnsCount: false
  },
  {
    id: "ops",
    name: "Ops",
    desc: "Daily operations, incidents, actions",
    envVar: "NEXT_PUBLIC_YKP_OPS_URL",
    defaultUrl: "https://ops.oseedigital.tech",
    probePath: "/api/ops/summary",
    probeReturnsCount: false
  }
] as const satisfies readonly HubModuleDef[];

export type HubModuleId = (typeof HUB_MODULES)[number]["id"];

export function findHubModule(id: string): HubModuleDef | undefined {
  return HUB_MODULES.find((m) => m.id === id);
}

/**
 * Env-overridden base URL (no trailing slash).
 *
 * IMPORTANT: access each NEXT_PUBLIC_* env var via a direct, statically-known
 * `process.env.X` reference (the switch below). Next.js only inlines
 * `NEXT_PUBLIC_*` into the client bundle when the variable name is a literal
 * at build time; `process.env[variable]` (dynamic key) and object-literal
 * maps are NOT replaced and resolve to `undefined` in the browser, which would
 * fall back to the localhost defaultUrl below — wrong in production.
 */
export function moduleBaseUrl(def: HubModuleDef): string {
  let url: string | undefined;
  switch (def.envVar) {
    case "NEXT_PUBLIC_YKP_OWNER_URL": url = process.env.NEXT_PUBLIC_YKP_OWNER_URL; break;
    case "NEXT_PUBLIC_YKP_HR_URL": url = process.env.NEXT_PUBLIC_YKP_HR_URL; break;
    case "NEXT_PUBLIC_YKP_FINANCE_URL": url = process.env.NEXT_PUBLIC_YKP_FINANCE_URL; break;
    case "NEXT_PUBLIC_YKP_WAREHOUSE_URL": url = process.env.NEXT_PUBLIC_YKP_WAREHOUSE_URL; break;
    case "NEXT_PUBLIC_YKP_INVESTOR_URL": url = process.env.NEXT_PUBLIC_YKP_INVESTOR_URL; break;
    case "NEXT_PUBLIC_YKP_OPS_URL": url = process.env.NEXT_PUBLIC_YKP_OPS_URL; break;
  }
  return (url ?? def.defaultUrl).replace(/\/+$/, "");
}

/** Full URL the health probe should hit for this module. */
export function moduleProbeUrl(def: HubModuleDef): string {
  return `${moduleBaseUrl(def)}${def.probePath}`;
}
