import Link from "next/link";
import type { Metadata } from "next";
import { Clock, Users, Wallet, Settings, BarChart3, LayoutDashboard } from "lucide-react";
import { cn } from "@ykp/ui";

export const metadata: Metadata = {
  title: "YKP HR — Dashboard",
  description: "HR, attendance & payroll dashboard",
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: ReadonlyArray<NavItem> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/attendance", label: "Attendance", icon: Clock },
  { href: "/payroll", label: "Payroll", icon: Wallet },
  { href: "/rules", label: "Rules", icon: Settings },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/summary", label: "Summary", icon: BarChart3 },
];

/**
 * Dashboard route group layout. Renders a fixed left sidebar with the six
 * HR navigation entries and a light-themed content shell. Light theme is
 * hard-wired here per binding contract §UI.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-xs font-bold">HR</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">YKP HR</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              People & Payroll
            </span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4 text-[10px] text-muted-foreground">
          v0.1.0 · Asia/Jakarta
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card/80 px-6 backdrop-blur">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground">
              <span className="text-[10px] font-bold">HR</span>
            </div>
            <span className="text-sm font-semibold">YKP HR</span>
          </div>
          <div className="hidden text-sm font-medium text-muted-foreground md:block">
            HR &amp; Payroll
          </div>
          <div className="text-xs text-muted-foreground">WIB</div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}