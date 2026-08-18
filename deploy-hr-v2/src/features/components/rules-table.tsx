"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Badge,
} from "../../../_packages/ui/src/index";
import {
  useCreateRule,
  useHrRules,
  useUpdateRule,
} from "@hr/features/api/queries";
import type { HrRuleRow } from "@hr/features/api/types";

/**
 * HR rules table client. Lists hr_rules per outlet, opens an edit modal
 * for HR_ADMIN that updates shift start/end, tolerance, overtime, and
 * payroll period cut-off.
 */
export function RulesTableClient(): JSX.Element {
  const { data, isLoading } = useHrRules();
  const update = useUpdateRule();
  const create = useCreateRule();
  const rows = data?.rules ?? [];

  const columns = React.useMemo<ColumnDef<HrRuleRow>[]>(
    () => [
      { accessorKey: "ruleId", header: "Rule ID" },
      { accessorKey: "outletId", header: "Outlet" },
      { accessorKey: "shiftName", header: "Shift" },
      {
        id: "window",
        header: "Shift Window",
        cell: ({ row }) => `${row.original.shiftStart} → ${row.original.shiftEnd}`,
      },
      {
        accessorKey: "lateToleranceMinutes",
        header: "Tolerance (min)",
        cell: ({ row }) => `${row.original.lateToleranceMinutes}m`,
      },
      {
        accessorKey: "overtimeRateMultiplier",
        header: "OT Multiplier",
        cell: ({ row }) => `${row.original.overtimeRateMultiplier}x`,
      },
      {
        accessorKey: "mandatoryCheckout",
        header: "Mandatory Checkout",
        cell: ({ row }) =>
          row.original.mandatoryCheckout ? (
            <Badge>Ya</Badge>
          ) : (
            <span className="text-muted-foreground">Tidak</span>
          ),
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => (
          <EditRuleDialog
            initial={row.original}
            onSave={(patch) => update.mutate({ id: row.original.ruleId, patch })}
          />
        ),
      },
    ],
    [update],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <CreateRuleDialog onCreate={(payload) => create.mutate(payload)} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Cari rule..."
        pageSize={10}
        emptyMessage={isLoading ? "Memuat..." : "Belum ada rule."}
      />
    </div>
  );
}

function EditRuleDialog({
  initial,
  onSave,
}: {
  initial: HrRuleRow;
  onSave: (patch: Partial<HrRuleRow>) => void;
}): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [tolerance, setTolerance] = React.useState(String(initial.lateToleranceMinutes));
  const [otMultiplier, setOtMultiplier] = React.useState(String(initial.overtimeRateMultiplier));
  const [otCap, setOtCap] = React.useState(String(initial.overtimeDailyCapHours));
  const [mandatory, setMandatory] = React.useState(initial.mandatoryCheckout);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Rule — {initial.shiftName}</DialogTitle>
          <DialogDescription>
            {initial.outletId} · shift {initial.shiftStart}–{initial.shiftEnd}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs">Late tolerance (minutes)</label>
          <Input
            type="number"
            value={tolerance}
            onChange={(e) => setTolerance(e.target.value)}
          />
          <label className="text-xs">Overtime multiplier</label>
          <Input
            type="number"
            step="0.1"
            value={otMultiplier}
            onChange={(e) => setOtMultiplier(e.target.value)}
          />
          <label className="text-xs">Daily OT cap (hours)</label>
          <Input
            type="number"
            step="0.5"
            value={otCap}
            onChange={(e) => setOtCap(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
            />
            Mandatory checkout
          </label>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              onSave({
                lateToleranceMinutes: Number(tolerance),
                overtimeRateMultiplier: otMultiplier,
                overtimeDailyCapHours: otCap,
                mandatoryCheckout: mandatory,
              });
              setOpen(false);
            }}
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateRuleDialog({ onCreate }: { onCreate: (payload: Partial<HrRuleRow>) => void }): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [outletId, setOutletId] = React.useState("");
  const [shiftName, setShiftName] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Tambah Rule</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat HR Rule baru</DialogTitle>
          <DialogDescription>
            Rule berlaku per outlet + shift.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Outlet ID (OL-001)" value={outletId} onChange={(e) => setOutletId(e.target.value)} />
          <Input placeholder="Shift name (Pagi)" value={shiftName} onChange={(e) => setShiftName(e.target.value)} />
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            disabled={!outletId || !shiftName || !start || !end}
            onClick={() => {
              onCreate({
                outletId,
                shiftName,
                shiftStart: start,
                shiftEnd: end,
              } as Partial<HrRuleRow>);
              setOpen(false);
            }}
          >
            Buat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}