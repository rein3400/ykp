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

/** Single brand accent (YKP red/black) shared by every module card. */
const BRAND_TONE: AppDef["tone"] = {
  gradient: "from-[#E01020] to-[#9c0b16]",
  text: "text-[#E01020] dark:text-red-400",
  ring: "ring-red-200 dark:ring-red-900",
  soft: "bg-red-50 dark:bg-red-900/30"
};

/** Icon + tone per module (presentation only — URLs/names live in app/config). */
const PRESENTATION: Record<AppId, { tone: AppDef["tone"]; icon: IconComponent }> = {
  owner: { tone: BRAND_TONE, icon: StarIcon },
  hr: { tone: BRAND_TONE, icon: HrIcon },
  finance: { tone: BRAND_TONE, icon: FinanceIcon },
  warehouse: { tone: BRAND_TONE, icon: DatabaseIcon },
  investor: { tone: BRAND_TONE, icon: ActivityIcon },
  ops: { tone: BRAND_TONE, icon: SheetsIcon },
  marketing: { tone: BRAND_TONE, icon: StarIcon }
};

/** The local YKP family, in display order. URLs come from app/config (env-overridable). */
export const APPS: AppDef[] = HUB_MODULES.filter((m) => m.url.trim().length > 0).map((m) => ({
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
  void role;
  return app.url;
}
