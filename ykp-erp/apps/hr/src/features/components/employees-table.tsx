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
} from "@ykp/ui";
import { formatIdr } from "@ykp/ui";
import { useCreateEmployee, useEmployees } from "@/features/api/queries";
import type { EmployeeRow } from "@/features/api/types";

/**
 * Employees client island. Roster + create-employee dialog + CSV import.
 */
export function EmployeesTableClient(): JSX.Element {
  const { data, isLoading } = useEmployees();
  const create = useCreateEmployee();
  const rows = data?.employees ?? [];

  const columns = React.useMemo<ColumnDef<EmployeeRow>[]>(
    () => [
      { accessorKey: "employeeId", header: "ID" },
      { accessorKey: "fullName", header: "Nama" },
      { accessorKey: "role", header: "Role" },
      { accessorKey: "department", header: "Departemen" },
      { accessorKey: "outletId", header: "Outlet" },
      {
        accessorKey: "baseSalary",
        header: "Gaji Pokok",
        cell: ({ row }) => formatIdr(row.original.baseSalary),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "active" ? (
            <Badge>Aktif</Badge>
          ) : (
            <Badge className="bg-muted text-muted-foreground">{row.original.status}</Badge>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <ImportCsvButton />
        <CreateEmployeeDialog onCreate={(payload) => create.mutate(payload)} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Cari karyawan..."
        pageSize={15}
        emptyMessage={isLoading ? "Memuat..." : "Belum ada karyawan."}
      />
    </div>
  );
}

function CreateEmployeeDialog({ onCreate }: { onCreate: (payload: Partial<EmployeeRow>) => void }): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [outletId, setOutletId] = React.useState("");
  const [baseSalary, setBaseSalary] = React.useState("0");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Karyawan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Karyawan</DialogTitle>
          <DialogDescription>
            Disimpan ke master_employee dengan status aktif.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Nama lengkap" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input placeholder="Role (e.g. barista)" value={role} onChange={(e) => setRole(e.target.value)} />
          <Input placeholder="Outlet ID" value={outletId} onChange={(e) => setOutletId(e.target.value)} />
          <Input
            type="number"
            placeholder="Gaji pokok (IDR)"
            value={baseSalary}
            onChange={(e) => setBaseSalary(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={!fullName}
            onClick={() => {
              onCreate({
                fullName,
                role: role || undefined,
                outletId: outletId || undefined,
                baseSalary: Number(baseSalary) || 0,
              });
              setOpen(false);
              setFullName("");
              setRole("");
              setOutletId("");
              setBaseSalary("0");
            }}
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportCsvButton(): JSX.Element {
  return (
    <Button size="sm" variant="outline" onClick={() => alert("CSV import — wire to /api/hr/employees batch endpoint")}>
      Import CSV
    </Button>
  );
}