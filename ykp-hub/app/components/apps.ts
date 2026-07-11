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