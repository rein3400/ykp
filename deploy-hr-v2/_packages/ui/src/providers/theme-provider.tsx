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
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      storageKey={storageKey}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

/** Inline dark/light toggle button. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
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