"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@ykp/ui";

type EnvironmentTag = "DEMO" | "TESTING" | "PRODUCTION";

interface AlertRow {
  alertId: string;
  date: string;
  brand: string | null;
  outlet: string | null;
  alertType: string;
  severity: "warning" | "critical";
  message: string;
  sourceApp: string;
  status: "open" | "ack" | "resolved";
  actionTaken: string;
  createdAt: string;
  resolvedAt: string | null;
  environment?: EnvironmentTag | string;
}

function envBadgeClass(env: string): string {
  switch (env) {
    case "DEMO":
      return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "TESTING":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "PRODUCTION":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

export default function AlertsPage() {
  const [items, setItems] = React.useState<AlertRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState({
    date: "",
    severity: "",
    status: "",
    alertType: "",
    outlet: "",
    environment: "",
  });
  const [active, setActive] = React.useState<AlertRow | null>(null);
  const [actionTaken, setActionTaken] = React.useState("");
  const [nextStatus, setNextStatus] = React.useState<"ack" | "resolved">("ack");
  const [submitting, setSubmitting] = React.useState(false);

  const fetchAlerts = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filter).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      const url = `/api/hermez/alerts${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setItems(json.data?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  async function submitStatus() {
    if (!active) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/hermez/alerts/${active.alertId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, action_taken: actionTaken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setActive(null);
      setActionTaken("");
      await fetchAlerts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Alert Log</h2>
        <p className="text-sm text-muted-foreground">
          Alert otomatis dari 7 trigger Hermez. Perubahan status hanya via owner/manager.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Input
            type="date"
            value={filter.date}
            onChange={(e) => setFilter((f) => ({ ...f, date: e.target.value }))}
            placeholder="Tanggal"
          />
          <select
            value={filter.severity}
            onChange={(e) => setFilter((f) => ({ ...f, severity: e.target.value }))}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Semua severity</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Semua status</option>
            <option value="open">Open</option>
            <option value="ack">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={filter.environment}
            onChange={(e) => setFilter((f) => ({ ...f, environment: e.target.value }))}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Semua env</option>
            <option value="DEMO">DEMO</option>
            <option value="TESTING">TESTING</option>
            <option value="PRODUCTION">PRODUCTION</option>
          </select>
          <Input
            value={filter.alertType}
            onChange={(e) => setFilter((f) => ({ ...f, alertType: e.target.value }))}
            placeholder="alert_type"
          />
          <Input
            value={filter.outlet}
            onChange={(e) => setFilter((f) => ({ ...f, outlet: e.target.value }))}
            placeholder="outlet"
          />
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-destructive">
          {error?.match(/unauthor/i)
            ? "Silakan login untuk mengakses data alert"
            : `Error: ${error}`}
        </p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Outlet</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Env</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                      Memuat...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <p className="text-sm font-medium text-foreground">
                        Tidak ada peringatan untuk filter saat ini.
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Semua sistem normal.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((a) => (
                    <tr key={a.alertId} className="border-b">
                      <td className="px-4 py-3 align-top">{a.date}</td>
                      <td className="px-4 py-3 align-top">{a.outlet ?? "—"}</td>
                      <td className="px-4 py-3 align-top capitalize">{a.alertType.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 align-top">
                        <Badge
                          variant={a.severity === "critical" ? "destructive" : "warning"}
                          className="uppercase"
                        >
                          {a.severity}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top max-w-md whitespace-normal">{a.message}</td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant="outline" className="capitalize">
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${envBadgeClass(a.environment ?? "PRODUCTION")}`}
                        >
                          {a.environment ?? "PRODUCTION"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Dialog>
                          <DialogTrigger asChild>
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
                          </DialogTrigger>
                          {active?.alertId === a.alertId ? (
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Ubah status alert</DialogTitle>
                                <DialogDescription>
                                  Alert {active.alertId} · {active.alertType}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-3">
                                <div className="flex gap-2">
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
                                <div className="space-y-1">
                                  <label className="text-sm" htmlFor="action-taken">
                                    Catatan tindakan
                                  </label>
                                  <textarea
                                    id="action-taken"
                                    rows={3}
                                    value={actionTaken}
                                    onChange={(e) => setActionTaken(e.target.value)}
                                    placeholder="Misal: hubungi PIC outlet X, cek struk, dll."
                                    className="w-full rounded-md border bg-background p-2 text-sm"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setActive(null)}>
                                  Batal
                                </Button>
                                <Button onClick={submitStatus} disabled={submitting}>
                                  {submitting ? "Menyimpan..." : "Simpan"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          ) : null}
                        </Dialog>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}