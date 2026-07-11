"use client";
import { useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "ykp_hub_theme";

function readStored(): Theme {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function resolveSystem(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const dark = theme === "dark" || (theme === "system" && resolveSystem());
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const t = readStored();
    setThemeState(t);
    applyTheme(t);

    // Listen for OS theme changes when on system mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const cur = readStored();
      if (cur === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(KEY, next);
    setThemeState(next);
    applyTheme(next);
  }, []);

  const cycle = useCallback(() => {
    const order: Theme[] = ["light", "dark", "system"];
    const i = order.indexOf(theme);
    setTheme(order[(i + 1) % 3]);
  }, [theme, setTheme]);

  return { theme, setTheme, cycle };
}