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

function requiredUrl(envVar: string): string {
  const v = process.env[envVar];
  if (!v || v.trim().length === 0) {
    throw new Error(
      `[hub/config] Missing required build-time env var "${envVar}". ` +
        `Set it in Coolify build args before building the hub image.`,
    );
  }
  return v;
}

export const HUB_MODULES: readonly HubModuleDef[] = [
  {
    id: "owner",
    name: "Owner Command",
    desc: "Cross-module read-only overview",
    url: requiredUrl("NEXT_PUBLIC_YKP_OWNER_URL"),
    probePath: "/login",
    probeReturnsCount: false
  },
  {
    id: "hr",
    name: "HR",
    desc: "Attendance, employees, roster",
    url: requiredUrl("NEXT_PUBLIC_YKP_HR_URL"),
    probePath: "/api/hr/summary/count",
    probeReturnsCount: true
  },
  {
    id: "finance",
    name: "Finance",
    desc: "POS, expenses, petty cash, daily summary",
    url: requiredUrl("NEXT_PUBLIC_YKP_FINANCE_URL"),
    probePath: "/api/fin/summary",
    probeReturnsCount: false
  },
  {
    id: "warehouse",
    name: "Warehouse",
    desc: "Stock, receiving, usage, waste",
    url: requiredUrl("NEXT_PUBLIC_YKP_WAREHOUSE_URL"),
    probePath: "/api/warehouse/summary",
    probeReturnsCount: false
  },
  {
    id: "investor",
    name: "Investor",
    desc: "Portfolio, capital, dividends",
    url: requiredUrl("NEXT_PUBLIC_YKP_INVESTOR_URL"),
    probePath: "/api/investor/summary",
    probeReturnsCount: false
  },
  {
    id: "ops",
    name: "Ops",
    desc: "Daily operations, incidents, actions",
    url: requiredUrl("NEXT_PUBLIC_YKP_OPS_URL"),
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

/**
 * Base URL for SERVER-SIDE calls (health probe, login proxy).
 *
 * The inlined NEXT_PUBLIC_* URL is a public address (Coolify host IP/domain).
 * A container cannot always reach the host's published port — Docker hairpin
 * NAT is off by default, so the request times out. Set
 * `YKP_<MODULE_ID>_INTERNAL_URL` (e.g. http://<coolify-resource-uuid>:3002) to
 * use the container-to-container address instead; browsers keep the public URL.
 */
export function moduleServerUrl(def: HubModuleDef): string {
  const override = process.env[`YKP_${def.id.toUpperCase()}_INTERNAL_URL`];
  if (override && override.trim().length > 0) {
    return override.replace(/\/+$/, "");
  }
  return moduleBaseUrl(def);
}

/** Full URL a server-side probe should hit for this module. */
export function moduleServerProbeUrl(def: HubModuleDef): string {
  return `${moduleServerUrl(def)}${def.probePath}`;
}
