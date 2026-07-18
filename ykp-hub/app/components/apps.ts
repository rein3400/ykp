import type { ComponentType, SVGProps } from "react";
import { FinanceIcon, HrIcon, HermezIcon, SheetsIcon } from "./icons";

export type AppId = "finance" | "hr" | "hermez" | "hr-v1" | "warehouse" | "investor" | "ops";

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
    desc: "POS, expenses, petty cash, supplier",
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
  },
  {
    id: "warehouse",
    name: "Warehouse",
    desc: "Stock, receiving, waste, purchase alerts",
    url: process.env.NEXT_PUBLIC_WAREHOUSE_URL ?? "https://ykp-warehouse-v1.vercel.app",
    tone: {
      gradient: "from-indigo-500 to-indigo-700",
      text: "text-indigo-600 dark:text-indigo-400",
      ring: "ring-indigo-200 dark:ring-indigo-800",
      soft: "bg-indigo-50 dark:bg-indigo-900/30"
    },
    icon: SheetsIcon
  },
  {
    id: "investor",
    name: "Investor",
    desc: "Capital, dividends, shareholding, returns",
    url: process.env.NEXT_PUBLIC_INVESTOR_URL ?? "https://ykp-investor-v1.vercel.app",
    tone: {
      gradient: "from-rose-500 to-rose-700",
      text: "text-rose-600 dark:text-rose-400",
      ring: "ring-rose-200 dark:ring-rose-800",
      soft: "bg-rose-50 dark:bg-rose-900/30"
    },
    icon: FinanceIcon
  },
  {
    id: "ops",
    name: "Operational",
    desc: "Opening checklist, KDS, QC, incidents, closing",
    url: process.env.NEXT_PUBLIC_OPS_URL ?? "https://ykp-ops-v1.vercel.app",
    tone: {
      gradient: "from-cyan-500 to-cyan-700",
      text: "text-cyan-600 dark:text-cyan-400",
      ring: "ring-cyan-200 dark:ring-cyan-800",
      soft: "bg-cyan-50 dark:bg-cyan-900/30"
    },
    icon: HrIcon
  }
];

export function findApp(id: AppId | null): AppDef | undefined {
  return APPS.find((a) => a.id === id);
}

/** Apps that accept GET /api/auth/login?role=&redirect= SSO. */
export const ROLE_SSO_APPS: ReadonlySet<AppId> = new Set<AppId>(["finance", "hr", "hermez"]);

export const SSO_ROLE: Partial<Record<AppId, string>> = {
  hermez: "SUPER_ADMIN",
};

export function ssoUrl(app: AppDef, role: string): string {
  if (!ROLE_SSO_APPS.has(app.id)) return app.url;
  const r = encodeURIComponent(SSO_ROLE[app.id] ?? role ?? "OWNER");
  return `${app.url}/api/auth/login?role=${r}&redirect=/`;
}
