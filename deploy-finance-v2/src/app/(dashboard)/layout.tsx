/**
 * Finance dashboard layout — OneFinance dark sidebar + content shell.
 * Wraps every page in the (dashboard) route group with the sidebar nav,
 * a top bar, and the dark theme already applied at the root layout.
 */
import Link from "next/link";
import {
  LayoutDashboard,
  Receipt,
  Truck,
  Coins,
  Wallet,
  BarChart3,
  Settings,
  TrendingUp,
} from "lucide-react";
import { cn } from "../../../_packages/ui/src";

const NAV = [
  { href: "/", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/pos", label: "POS Revenue", icon: Receipt },
  { href: "/suppliers", label: "Costing Supplier", icon: Truck },
  { href: "/petty-cash", label: "Petty Cash", icon: Coins },
  { href: "/expenses", label: "Expense Log", icon: Wallet },
  { href: "/summary", label: "Summary", icon: TrendingUp },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-border px-6">
          <span className="text-sm font-semibold tracking-tight">YKP Finance</span>
          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
            OneFinance
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
          <p>v0.1.0 · dark</p>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <h1 className="text-sm font-semibold">Finance Command Center</h1>
          <span className="text-xs text-muted-foreground">WIB · IDR</span>
        </header>
        <main className="flex-1 space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}