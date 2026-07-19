"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@ykp/ui";
import { cn } from "@ykp/ui";

const NAV = [
  { href: "/", label: "Ringkasan Harian" },
  { href: "/alerts", label: "Peringatan" },
  { href: "/actions", label: "Actions" },
  { href: "/warehouse", label: "Warehouse" },
  { href: "/config", label: "Konfigurasi" },
  { href: "/run", label: "Jalankan" },
  { href: "/telegram-test", label: "Tes Telegram" },
  { href: "/telegram-bot", label: "Bot Telegram" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = NAV.find((n) =>
    n.href === "/" ? pathname === "/" : pathname?.startsWith(n.href)
  );
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar px-4 py-6 md:block">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">YKP</p>
          <h1 className="text-lg font-semibold">Hermez</h1>
          <p className="text-xs text-muted-foreground">AI Command Center</p>
        </div>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex w-full flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <p className="text-sm text-muted-foreground">{current?.label ?? "Dashboard"}</p>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}