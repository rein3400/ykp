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

const STATUS_OPTIONS = [
  ["", "Semua status"],
  ["OPEN", "Open"],
  ["IN_PROGRESS", "In Progress"],
  ["WAITING_APPROVAL", "Waiting Approval"],
  ["DONE", "Done"],
  ["CANCELLED", "Cancelled"],
  ["OVERDUE", "Overdue"],
] as const;

const PRIORITY_OPTIONS = [
  ["LOW", "Low"],
  ["MEDIUM", "Medium"],
  ["HIGH", "High"],
  ["CRITICAL", "Critical"],
] as const;

interface ActionRow {
  actionId: string;
  sourceAlertId: string | null;
  title: string;
  brand: string | null;
  outlet: string | null;
  assignedTo: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate: string | null;
  status:
    | "OPEN"
    | "IN_PROGRESS"
    | "WAITING_APPROVAL"
    | "DONE"
    | "CANCELLED"
    | "OVERDUE";
  actionTaken: string | null;
  createdAt: string;
  completedAt: string | null;
}

function priorityVariant(priority: ActionRow["priority"]) {
  switch (priority) {
    case "CRITICAL":
      return "destructive" as const;
    case "HIGH":
      return "warning" as const;
    case "MEDIUM":
    default:
      return "default" as const;
    case "LOW":
      return "secondary" as const;
  }
}

function statusVariant(status: ActionRow["status"]) {
  switch (status) {
    case "DONE":
      return "success" as const;
    case "IN_PROGRESS":
      return "default" as const;
    case "WAITING_APPROVAL":
      return "outline" as const;
    case "OVERDUE":
      return "destructive" as const;
    case "CANCELLED":
      return "secondary" as const;
    case "OPEN":
    default:
      return "outline" as const;
  }
}

export default function ActionsPage() {
  const [items, setItems] = React.useState<ActionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    title: "",
    brand: "",
    outlet: "",
    assignedTo: "",
    priority: "MEDIUM" as ActionRow["priority"],
    dueDate: "",
    sourceAlertId: "",
  });

  const [submitting, setSubmitting] = React.useState(false);

  const fetchActions = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const url = `/api/hermez/actions${params.toString() ? `?${params}` : ""}`;
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
  }, [statusFilter]);

  React.useEffect(() => {
    void fetchActions();
  }, [fetchActions]);

  async function createAction(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        title: form.title.trim(),
        priority: form.priority,
      };
      if (form.brand.trim()) payload.brand = form.brand.trim();
      if (form.outlet.trim()) payload.outlet = form.outlet.trim();
      if (form.assignedTo.trim()) payload.assignedTo = form.assignedTo.trim();
      if (form.dueDate) payload.dueDate = form.dueDate;
      if (form.sourceAlertId.trim()) payload.sourceAlertId = form.sourceAlertId.trim();

      const res = await fetch("/api/hermez/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);

      setForm({
        title: "",
        brand: "",
        outlet: "",
        assignedTo: "",
        priority: "MEDIUM",
        dueDate: "",
        sourceAlertId: "",
      });
      setIsCreateOpen(false);
      await fetchActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function patchStatus(actionId: string, nextStatus: ActionRow["status"]) {
    try {
      const res = await fetch(`/api/hermez/actions/${actionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      await fetchActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const isDone = (status: string) => status === "DONE" || status === "CANCELLED";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Action Tracker</h2>
          <p className="text-sm text-muted-foreground">
            Tindak lanjut alert dan keputusan Hermez.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>Buat Action</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={createAction}>
              <DialogHeader>
                <DialogTitle>Buat action baru</DialogTitle>
                <DialogDescription>
                  Catat tindak lanjut dari alert atau briefing harian.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="action-title" className="text-sm font-medium">Judul / Task</label>
                  <Input
                    id="action-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Contoh: Follow-up keterlambatan staf outlet A"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="action-brand" className="text-sm font-medium">Brand</label>
                    <Input
                      id="action-brand"
                      value={form.brand}
                      onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                      placeholder="BR-001"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="action-outlet" className="text-sm font-medium">Outlet</label>
                    <Input
                      id="action-outlet"
                      value={form.outlet}
                      onChange={(e) => setForm((f) => ({ ...f, outlet: e.target.value }))}
                      placeholder="OL-001"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="action-assigned" className="text-sm font-medium">Assigned To</label>
                    <Input
                      id="action-assigned"
                      value={form.assignedTo}
                      onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                      placeholder="Email / nama PIC"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="action-priority" className="text-sm font-medium">Priority</label>
                    <select
                      id="action-priority"
                      value={form.priority}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, priority: e.target.value as ActionRow["priority"] }))
                      }
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      {PRIORITY_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="action-due" className="text-sm font-medium">Due Date</label>
                    <Input
                      id="action-due"
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="action-alert" className="text-sm font-medium">Source Alert ID</label>
                    <Input
                      id="action-alert"
                      value={form.sourceAlertId}
                      onChange={(e) => setForm((f) => ({ ...f, sourceAlertId: e.target.value }))}
                      placeholder="HZAL-..."
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-destructive">
          {error?.match(/unauthor/i)
            ? "Silakan login untuk mengakses action tracker"
            : `Error: ${error}`}
        </p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Outlet</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
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
                    <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                      Tidak ada action untuk filter saat ini.
                    </td>
                  </tr>
                ) : (
                  items.map((a) => (
                    <tr key={a.actionId} className="border-b">
                      <td className="px-4 py-3 align-top font-medium">
                        {a.title}
                        {a.sourceAlertId ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            From {a.sourceAlertId}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">{a.brand ?? "—"}</td>
                      <td className="px-4 py-3 align-top">{a.outlet ?? "—"}</td>
                      <td className="px-4 py-3 align-top">{a.assignedTo ?? "—"}</td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={priorityVariant(a.priority)} className="uppercase">
                          {a.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">{a.dueDate ?? "—"}</td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={statusVariant(a.status)} className="uppercase">
                          {a.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={a.status === "IN_PROGRESS" || isDone(a.status)}
                            onClick={() => patchStatus(a.actionId, "IN_PROGRESS")}
                          >
                            Start
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={a.status === "DONE" || a.status === "CANCELLED"}
                            onClick={() => patchStatus(a.actionId, "DONE")}
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={a.status === "CANCELLED" || a.status === "DONE"}
                            onClick={() => patchStatus(a.actionId, "CANCELLED")}
                          >
                            Cancel
                          </Button>
                        </div>
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
