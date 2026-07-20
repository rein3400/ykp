"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from '../components/button';

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme applied on first load. */
  defaultTheme?: "light" | "dark";
  /** Storage key used by next-themes. */
  storageKey?: string;
}

/**
 * Wraps the app with next-themes provider so dark/light tokens from
 * `@ykp/config/tailwind-preset.css` switch deterministically.
 */
export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "ykp-theme",
}: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      storageKey={storageKey}
      enableSystem={false}
      disableTransitionOnChange
    >
      {mounted ? children : <div style={{ visibility: "hidden" }}>{children}</div>}
    </NextThemesProvider>
  );
}

/** Inline dark/light toggle button. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Hydration guard (React #418 fix): on the server, next-themes has no
  // theme value — `theme` is undefined — so `isDark` computed false and the
  // server rendered <Moon> + "Aktifkan mode gelap", while the hydrated
  // client (localStorage theme = dark) rendered <Sun> + different label.
  // Text/props mismatch on every page that mounts this toggle.
  // Render a stable placeholder until mounted on the client.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-hidden="true" tabIndex={-1}>
        <span className="h-4 w-4 inline-block" />
      </Button>
    );
  }

  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}