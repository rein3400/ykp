import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@ykp/ui";
import { QueryProvider } from "@ykp/ui";

export const metadata: Metadata = {
  title: "YKP Hermez",
  description: "Hermez AI Command Center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        <ThemeProvider defaultTheme="dark" storageKey="ykp-hermez-theme">
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
