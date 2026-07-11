import type { ComponentType, SVGProps } from "react";
import { FinanceIcon, HrIcon, HermezIcon, SheetsIcon } from "./icons";

export type AppId = "finance" | "hr" | "hermez" | "hr-v1";

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

export const APPS: AppDef[] = [
  {
    id: "finance",
    name: "Finance",
    desc: "POS, expenses, petty cash, payroll",
    url: "https://ykp-erp-finance-production.up.railway.app",
    tone: {
      gradient: "from-blue-500 to-blue-700",
      text: "text-blue-600 dark:text-blue-400",
      ring: "ring-blue-200 dark:ring-blue-800",
      soft: "bg-blue-50 dark:bg-blue-900/30"
    },
    icon: FinanceIcon
  },
  {
    id: "hr",
    name: "HR Production",
    desc: "Attendance, employees, rules, roster",
    url: "https://ykp-erp-hr-production.up.railway.app",
    tone: {
      gradient: "from-emerald-500 to-emerald-700",
      text: "text-emerald-600 dark:text-emerald-400",
      ring: "ring-emerald-200 dark:ring-emerald-800",
      soft: "bg-emerald-50 dark:bg-emerald-900/30"
    },
    icon: HrIcon
  },
  {
    id: "hermez",
    name: "Hermez AI",
    desc: "Briefs, alerts, config, run console",
    url: "https://ykp-erp-hermez-production.up.railway.app",
    tone: {
      gradient: "from-purple-500 to-purple-700",
      text: "text-purple-600 dark:text-purple-400",
      ring: "ring-purple-200 dark:ring-purple-800",
      soft: "bg-purple-50 dark:bg-purple-900/30"
    },
    icon: HermezIcon
  },
  {
    id: "hr-v1",
    name: "HR Pilot",
    desc: "Pilot attendance via Google Sheets",
    url: "https://ykp-hr-v1-standalone-production.up.railway.app",
    tone: {
      gradient: "from-orange-500 to-orange-700",
      text: "text-orange-600 dark:text-orange-400",
      ring: "ring-orange-200 dark:ring-orange-800",
      soft: "bg-orange-50 dark:bg-orange-900/30"
    },
    icon: SheetsIcon
  }
];

export function findApp(id: AppId | null): AppDef | undefined {
  return APPS.find((a) => a.id === id);
}

/**
 * Apps whose login is a demo role-picker (POST /api/auth/login {role}).
 * These accept a GET SSO bridge: /api/auth/login?role=X&redirect=/ → cookie → 302.
 * hr-v1 has real username/password auth (Google Sheets users tab), so it
 * cannot be auto-logged-in from Hub — the user logs in manually there.
 */
export const ROLE_SSO_APPS: ReadonlySet<AppId> = new Set<AppId>(["finance", "hr", "hermez"]);

/**
 * Per-app SSO role override. Some apps require a higher role than the Hub
 * session to access key APIs. Notably Hermez's config + brief APIs require
 * SUPER_ADMIN — if a Hub OWNER opens Hermez, minting a ykp_session with
 * role=OWNER yields 403 "insufficient role" on those APIs. So Hermez SSO
 * always mints SUPER_ADMIN regardless of Hub role. Finance/HR accept the
 * Hub session role (defaulting to OWNER) since their APIs gate on OWNER+.
 */
export const SSO_ROLE: Partial<Record<AppId, string>> = {
  hermez: "SUPER_ADMIN",
};

/**
 * Build the URL to open an app from Hub so the user lands authenticated.
 * - Role-picker apps (finance/hr/hermez): hit /api/auth/login?role=&redirect=/
 *   which mints the ykp_session cookie then 302s to "/". Use SSO_ROLE override
 *   if present, otherwise the Hub session role (so the ERP app grants the same
 *   access level). Hermez always gets SUPER_ADMIN (config/brief require it).
 * - hr-v1: no SSO (real credentials) → bare root, user logs in manually.
 */
export function ssoUrl(app: AppDef, role: string): string {
  if (!ROLE_SSO_APPS.has(app.id)) return app.url;
  const r = encodeURIComponent(SSO_ROLE[app.id] ?? role ?? "OWNER");
  return `${app.url}/api/auth/login?role=${r}&redirect=/`;
}