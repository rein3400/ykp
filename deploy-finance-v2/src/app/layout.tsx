import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider, QueryProvider } from "../../_packages/ui/src";

export const metadata: Metadata = {
  title: "YKP Finance",
  description: "OneFinance — konsolidasi revenue, costing, petty cash, dan ringkasan finance harian.",
};

/**
 * Root layout. Dark theme is forced via the `dark` class on <html> so the
 * OneFinance surface renders without a flash of light tokens on first paint.
 * ThemeProvider still allows runtime toggle for accessibility, but the
 * default storage key + forced class keep the finance app dark-first.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider defaultTheme="dark" storageKey="ykp-finance-theme">
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}