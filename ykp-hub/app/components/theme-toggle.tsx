"use client";
import { SunIcon, MoonIcon, ComputerIcon } from "./icons";
import { useTheme } from "../hooks/use-theme";

interface Props {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: Props) {
  const { theme, setTheme, cycle } = useTheme();
  const opts = [
    { v: "light" as const, icon: SunIcon, label: "Light" },
    { v: "dark" as const, icon: MoonIcon, label: "Dark" },
    { v: "system" as const, icon: ComputerIcon, label: "System" }
  ];
  if (compact) {
    const Cur = theme === "light" ? SunIcon : theme === "dark" ? MoonIcon : ComputerIcon;
    return (
      <button
        onClick={cycle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        title={`Theme: ${theme}`}
        aria-label="Toggle theme"
      >
        <Cur className="h-4 w-4" />
      </button>
    );
  }
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
      {opts.map((o) => {
        const Icon = o.icon;
        const active = theme === o.v;
        return (
          <button
            key={o.v}
            onClick={() => setTheme(o.v)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition focus-ring ${
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
            aria-label={o.label}
            aria-pressed={active}
          >
            <Icon className="h-3.5 w-3.5" />
            {!compact && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}