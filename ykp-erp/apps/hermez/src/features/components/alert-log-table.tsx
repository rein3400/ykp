"use client";

import * as React from "react";
import { Badge, Button } from "@ykp/ui";
import { fetchAlerts, patchAlertStatus } from "../api/service";
import type { AlertRow, AlertStatus } from "../api/types";

function severityVariant(severity: AlertRow["severity"]) {
  return severity === "critical" ? ("destructive" as const) : ("warning" as const);
}

export function AlertLogTable({ filters }: { filters?: { date?: string; severity?: string; status?: string; alert_type?: string; outlet?: string } }) {
  const [items, setItems] = React.useState<AlertRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [active, setActive] = React.useState<AlertRow | null>(null);
  const [actionTaken, setActionTaken] = React.useState("");
  const [nextStatus, setNextStatus] = React.useState<AlertStatus>("ack");
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAlerts(filters ?? {});
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!active) return;
    setSubmitting(true);
    try {
      await patchAlertStatus(active.alertId, nextStatus, actionTaken);
      setActive(null);
      setActionTaken("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Memuat alert...</p>;
  if (error) return <p className="text-sm text-destructive">Error: {error}</p>;

  return (
    <div className="space-y-4">
      <div className="overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Outlet</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Tidak ada alert.
                </td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={a.alertId} className="border-b">
                  <td className="px-3 py-2 align-top">{a.date}</td>
                  <td className="px-3 py-2 align-top">{a.outlet ?? "—"}</td>
                  <td className="px-3 py-2 align-top capitalize">{a.alertType.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 align-top">
                    <Badge variant={severityVariant(a.severity)} className="uppercase">
                      {a.severity}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 align-top max-w-md whitespace-normal">{a.message}</td>
                  <td className="px-3 py-2 align-top">
                    <Badge variant="outline" className="capitalize">
                      {a.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={a.status === "resolved"}
                      onClick={() => {
                        setActive(a);
                        setNextStatus(a.status === "open" ? "ack" : "resolved");
                        setActionTaken("");
                      }}
                    >
                      Ubah
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-md border bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Ubah status alert</h3>
            <p className="text-sm text-muted-foreground">
              {active.alertId} · {active.alertType}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant={nextStatus === "ack" ? "default" : "outline"}
                onClick={() => setNextStatus("ack")}
              >
                Acknowledge
              </Button>
              <Button
                size="sm"
                variant={nextStatus === "resolved" ? "default" : "outline"}
                onClick={() => setNextStatus("resolved")}
              >
                Resolve
              </Button>
            </div>
            <div className="mt-3 space-y-1">
              <label className="text-sm" htmlFor="alt-action">
                Catatan tindakan
              </label>
              <textarea
                id="alt-action"
                rows={3}
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                className="w-full rounded-md border bg-background p-2 text-sm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setActive(null)}>
                Batal
              </Button>
              <Button size="sm" onClick={submit} disabled={submitting}>
                {submitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}