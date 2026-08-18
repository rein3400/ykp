import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "../../_packages/ui/src";
import { QueryProvider } from "../../_packages/ui/src";

export const metadata: Metadata = {
  title: "YKP Hermez",
  description: "Hermez AI Command Center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider defaultTheme="dark" storageKey="ykp-hermez-theme">
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
