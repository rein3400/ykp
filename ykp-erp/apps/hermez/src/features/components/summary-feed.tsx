"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ykp/ui";

interface SummaryRow {
  outlet: string;
  brand: string;
  date: string;
  staffPresent?: number;
  staffLate?: number;
  staffAbsent?: number;
  revenue?: number;
  netProfit?: number;
  cashDifference?: number;
}

function formatRupiah(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  return `${sign}Rp ${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export function SummaryFeed({ rows }: { rows: SummaryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada summary untuk ditampilkan.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <Card key={`${r.outlet}-${r.date}`}>
          <CardHeader>
            <CardTitle className="text-base">{r.outlet}</CardTitle>
            <CardDescription>
              {r.brand} · {r.date}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Present</span>
              <span>{r.staffPresent ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Late</span>
              <span>{r.staffLate ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Absent</span>
              <span>{r.staffAbsent ?? "—"}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span>{r.revenue !== undefined ? formatRupiah(r.revenue) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net profit</span>
                <span>{r.netProfit !== undefined ? formatRupiah(r.netProfit) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash diff</span>
                <span
                  className={
                    r.cashDifference && r.cashDifference !== 0 ? "text-destructive" : ""
                  }
                >
                  {r.cashDifference !== undefined ? formatRupiah(r.cashDifference) : "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}