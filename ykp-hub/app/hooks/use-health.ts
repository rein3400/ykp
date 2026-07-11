"use client";
import { useEffect, useState, useCallback, useRef } from "react";

export interface HealthResult {
  id: string;
  name: string;
  url: string;
  pingMs: number;
  httpStatus: number | null;
  reachable: boolean;
  recordCount: number | null;
}
export interface Health {
  overall: "ok" | "degraded" | "down";
  results: HealthResult[];
  ts: string;
}

const PING_HISTORY_MAX = 12;

/** Polls /api/health every intervalMs and keeps a small per-module ping history. */
export function useHealth(intervalMs = 30_000) {
  const [health, setHealth] = useState<Health | null>(null);
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      if (!mounted.current) return;
      if (r.ok) {
        const j = await r.json();
        const h: Health = j.data;
        setHealth(h);
        setHistory((prev) => {
          const next: Record<string, number[]> = { ...prev };
          for (const r of h.results) {
            const arr = next[r.id] ?? [];
            arr.push(r.pingMs);
            if (arr.length > PING_HISTORY_MAX) arr.shift();
            next[r.id] = arr;
          }
          return next;
        });
      }
    } catch {
      // ignore
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const t = setInterval(refresh, intervalMs);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [refresh, intervalMs]);

  return { health, history, loading, refresh };
}