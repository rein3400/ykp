"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from './card';
import { cn } from '../lib/utils';

export interface KpiCardProps {
  /** Display title of the metric. */
  title: string;
  /** Pre-formatted value string (e.g. `Rp 4.500.000`). */
  value: string | number;
  /** Optional delta vs previous period. Positive renders up, negative down. */
  delta?: number;
  /** Optional lucide-react icon node rendered in a muted tile. */
  icon?: React.ReactNode;
  /** Optional trend sparkline or progress rendered below the value. */
  trend?: React.ReactNode;
  /** Suffix rendered inline next to the delta (e.g. `%`, `pts`). */
  deltaSuffix?: string;
  /** Hide the delta arrow (still renders numeric delta). */
  hideArrow?: boolean;
  className?: string;
}

/**
 * KPI tile for dashboard summaries. Renders title, big value, delta pill
 * (green/red/neutral based on sign) and an optional icon + trend slot.
 */
export function KpiCard({
  title,
  value,
  delta,
  icon,
  trend,
  deltaSuffix = "",
  hideArrow = false,
  className,
}: KpiCardProps) {
  const positive = typeof delta === "number" && delta > 0;
  const negative = typeof delta === "number" && delta < 0;
  const neutral = !positive && !negative;
  const Arrow = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const deltaColor = positive
    ? "text-success"
    : negative
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight">
              {typeof value === "number" ? value.toLocaleString("id-ID") : value}
            </p>
          </div>
          {icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {icon}
            </div>
          ) : null}
        </div>

        {typeof delta === "number" ? (
          <div className={cn("mt-3 flex items-center gap-1 text-xs", deltaColor)}>
            {!hideArrow ? <Arrow className="h-3.5 w-3.5" /> : null}
            <span className="font-medium">
              {positive ? "+" : ""}
              {delta}
              {deltaSuffix}
            </span>
            {neutral ? <span className="text-muted-foreground">vs prev period</span> : null}
          </div>
        ) : null}

        {trend ? <div className="mt-4">{trend}</div> : null}
      </CardContent>
    </Card>
  );
}