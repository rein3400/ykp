import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@ykp/ui";
import { QueryProvider } from "@ykp/ui";

export const metadata: Metadata = {
  title: "YKP HR",
  description: "HR & payroll dashboard",
};

/**
 * Root layout for the HR app. Forces LIGHT theme (binding contract §UI
 * specifies HR dashboard is light mode). Wraps every page in TanStack
 * QueryProvider so client components can use the same cache across the
 * dashboard tree.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="light" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider defaultTheme="light" storageKey="ykp-hr-theme">
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}