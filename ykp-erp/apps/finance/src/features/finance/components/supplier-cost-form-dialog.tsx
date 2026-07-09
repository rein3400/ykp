/**
 * Dialog untuk create/edit supplier cost. Edit mode hanya menyetel
 * paid_amount / notes; create mode kirim full POST body.
 */
"use client";

import * as React from "react";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ykp/ui";
import { useOutlets, useSuppliers } from '../api/queries';
import { useCreateSupplier, usePatchSupplier } from '../api/mutations';
import type { SupplierCost } from '../api/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row?: SupplierCost | null;
}

export function SupplierCostFormDialog({ open, onOpenChange, row }: Props) {
  const { data: outlets = [] } = useOutlets();
  const { data: suppliers = [] } = useSuppliers();
  const create = useCreateSupplier();
  const patch = usePatchSupplier();

  const [form, setForm] = React.useState({
    date: new Date().toISOString().slice(0, 10),
    outlet_id: "",
    supplier_id: "",
    description: "",
    category: "",
    amount: 0,
    paid_amount: 0,
    due_date: "",
    notes: "",
  });

  React.useEffect(() => {
    if (row) {
      setForm({
        date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
        outlet_id: row.outletId,
        supplier_id: row.supplierId,
        description: row.description ?? "",
        category: row.category ?? "",
        amount: row.amount,
        paid_amount: row.paidAmount,
        due_date: row.dueDate ? (row.dueDate instanceof Date ? row.dueDate.toISOString().slice(0, 10) : String(row.dueDate).slice(0, 10)) : "",
        notes: row.notes ?? "",
      });
    } else {
      setForm({
        date: new Date().toISOString().slice(0, 10),
        outlet_id: "",
        supplier_id: "",
        description: "",
        category: "",
        amount: 0,
        paid_amount: 0,
        due_date: "",
        notes: "",
      });
    }
  }, [row, open]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (row) {
      patch.mutate({ id: row.costId, body: { paid_amount: form.paid_amount, notes: form.notes, due_date: form.due_date } }, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate({
        date: form.date,
        outlet_id: form.outlet_id,
        supplier_id: form.supplier_id,
        description: form.description,
        category: form.category,
        amount: form.amount,
        paid_amount: form.paid_amount,
        due_date: form.due_date,
        notes: form.notes,
      }, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row ? "Update Pembayaran Supplier" : "Tambah Supplier Cost"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Tanggal</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Outlet</Label>
              <Select value={form.outlet_id} onValueChange={(v) => setForm((f) => ({ ...f, outlet_id: v }))} disabled={Boolean(row)}>
                <SelectTrigger><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
                <SelectContent>
                  {outlets.map((o) => <SelectItem key={o.outletId} value={o.outletId}>{o.outletName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))} disabled={Boolean(row)}>
                <SelectTrigger><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.supplierId} value={s.supplierId}>{s.supplierName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Total</Label>
              <Input type="number" min={0} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} required disabled={Boolean(row)} />
            </div>
            <div className="grid gap-2">
              <Label>Sudah Dibayar</Label>
              <Input type="number" min={0} value={form.paid_amount} onChange={(e) => setForm((f) => ({ ...f, paid_amount: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Jatuh Tempo</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label>Catatan</Label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button type="submit" disabled={create.isPending || patch.isPending}>
            {row ? "Update" : "Simpan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
