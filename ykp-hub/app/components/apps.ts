import type { ComponentType, SVGProps } from "react";
import {
  ActivityIcon, DatabaseIcon, FinanceIcon, HrIcon, SheetsIcon, StarIcon
} from "./icons";
import { HUB_MODULES, moduleBaseUrl, type HubModuleId } from "../config";

export type AppId = HubModuleId;

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface AppDef {
  id: AppId;
  name: string;
  desc: string;
  url: string;
  tone: {
    gradient: string;
    text: string;
    ring: string;
    soft: string;
  };
  icon: IconComponent;
}

/** Icon + tone per module (presentation only — URLs/names live in app/config). */
const PRESENTATION: Record<AppId, { tone: AppDef["tone"]; icon: IconComponent }> = {
  owner: {
    tone: {
      gradient: "from-indigo-500 to-indigo-700",
      text: "text-indigo-600 dark:text-indigo-400",
      ring: "ring-indigo-200 dark:ring-indigo-800",
      soft: "bg-indigo-50 dark:bg-indigo-900/30"
    },
    icon: StarIcon
  },
  hr: {
    tone: {
      gradient: "from-emerald-500 to-emerald-700",
      text: "text-emerald-700 dark:text-emerald-400",
      ring: "ring-emerald-200 dark:ring-emerald-800",
      soft: "bg-emerald-50 dark:bg-emerald-900/30"
    },
    icon: HrIcon
  },
  finance: {
    tone: {
      gradient: "from-blue-500 to-blue-700",
      text: "text-blue-600 dark:text-blue-400",
      ring: "ring-blue-200 dark:ring-blue-800",
      soft: "bg-blue-50 dark:bg-blue-900/30"
    },
    icon: FinanceIcon
  },
  warehouse: {
    tone: {
      gradient: "from-amber-600 to-amber-800",
      text: "text-amber-700 dark:text-amber-400",
      ring: "ring-amber-200 dark:ring-amber-800",
      soft: "bg-amber-50 dark:bg-amber-900/30"
    },
    icon: DatabaseIcon
  },
  investor: {
    tone: {
      gradient: "from-purple-500 to-purple-700",
      text: "text-purple-600 dark:text-purple-400",
      ring: "ring-purple-200 dark:ring-purple-800",
      soft: "bg-purple-50 dark:bg-purple-900/30"
    },
    icon: ActivityIcon
  },
  ops: {
    tone: {
      gradient: "from-orange-600 to-orange-800",
      text: "text-orange-700 dark:text-orange-400",
      ring: "ring-orange-200 dark:ring-orange-800",
      soft: "bg-orange-50 dark:bg-orange-900/30"
    },
    icon: SheetsIcon
  }
};

/** The local YKP family, in display order. URLs come from app/config (env-overridable). */
export const APPS: AppDef[] = HUB_MODULES.map((m) => ({
  id: m.id,
  name: m.name,
  desc: m.desc,
  url: moduleBaseUrl(m),
  tone: PRESENTATION[m.id].tone,
  icon: PRESENTATION[m.id].icon
}));

export function findApp(id: AppId | null): AppDef | undefined {
  return APPS.find((a) => a.id === id);
}

/**
 * Apps that expose a GET SSO bridge:
 *   /api/auth/login?role=<hubRole>&token=<ERP_SSO_SECRET>&redirect=/
 * minting a session cookie and 302-redirecting into the app.
 *
 *   - finance (ykp-erp-finance): ERP demo SSO, token-gated, role mint.
 *   - owner   (ykp-erp-hermez, "Owner Command"): ERP demo SSO, token-gated,
 *             needs SUPER_ADMIN → see SSO_ROLE override below.
 *   - ops     (ykp-ops-v1): GET SSO bridge, maps hub role onto owner/staff
 *             (no shared token; role mapping only).
 *
 * NOT here (manual username/password, no GET SSO bridge):
 *   - hr       (ykp-hr-v1 Sheets): POST-only bcrypt login against Sheets
 *              users tab — there is no /api/auth/login GET handler, so an SSO
 *              link would 404/401. Hub opens the app root; user logs in.
 *   - warehouse, investor (Sheets apps): same — manual login.
 */
export const ROLE_SSO_APPS: ReadonlySet<AppId> = new Set<AppId>(["ops"]);

/**
 * Per-app SSO role override. Hermez (Owner Command) config/brief APIs
 * require SUPER_ADMIN, so we override the role regardless of the hub role.
 */
export const SSO_ROLE: Partial<Record<AppId, string>> = {
  owner: "SUPER_ADMIN",
};

/**
 * Build the URL to open an app from Hub so the user lands authenticated.
 * Apps in ROLE_SSO_APPS get the SSO bridge URL; others get the app base URL.
 * The ERP demo SSO bridge requires `ERP_SSO_SECRET` as a token to prevent
 * unauthenticated role minting.
 */
export function ssoUrl(app: AppDef, role: string): string {
  if (!ROLE_SSO_APPS.has(app.id)) return app.url;
  const r = encodeURIComponent(SSO_ROLE[app.id] ?? role ?? "OWNER");
  const token = encodeURIComponent(process.env.NEXT_PUBLIC_ERP_SSO_SECRET ?? "");
  return `${app.url}/api/auth/login?role=${r}&token=${token}&redirect=/`;
}
