/**
 * Dialog inline untuk mencatat transaksi POS baru (manual entry).
 * Mengirim POST /api/fin/pos. Outlet diambil dari master data query.
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
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ykp/ui";
import { Plus } from "lucide-react";
import { useCreatePos } from "../api/mutations.js";
import { useOutlets } from "../api/queries.js";
import type { CreatePosBody } from "../api/types.js";

export function PosFormDialog() {
  const [open, setOpen] = React.useState(false);
  const { data: outlets = [] } = useOutlets();
  const create = useCreatePos();

  const [form, setForm] = React.useState<CreatePosBody>({
    date: new Date().toISOString().slice(0, 10),
    outlet_id: "",
    gross_sales: 0,
    payment_method: "Cash",
    source: "manual",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.outlet_id || form.gross_sales <= 0) return;
    create.mutate(form, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Catat transaksi baru
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat Transaksi POS</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="pos-date">Tanggal</Label>
            <Input id="pos-date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pos-outlet">Outlet</Label>
            <Select value={form.outlet_id} onValueChange={(v) => setForm((f) => ({ ...f, outlet_id: v }))}>
              <SelectTrigger id="pos-outlet">
                <SelectValue placeholder="Pilih outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets.map((o) => (
                  <SelectItem key={o.outletId} value={o.outletId}>
                    {o.outletName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pos-gross">Gross Sales</Label>
              <Input id="pos-gross" type="number" min={0} value={form.gross_sales} onChange={(e) => setForm((f) => ({ ...f, gross_sales: Number(e.target.value) }))} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-discount">Discount</Label>
              <Input id="pos-discount" type="number" min={0} value={form.discount ?? 0} onChange={(e) => setForm((f) => ({ ...f, discount: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pos-refund">Refund</Label>
              <Input id="pos-refund" type="number" min={0} value={form.refund ?? 0} onChange={(e) => setForm((f) => ({ ...f, refund: Number(e.target.value) }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-void">Void</Label>
              <Input id="pos-void" type="number" min={0} value={form.void_amount ?? 0} onChange={(e) => setForm((f) => ({ ...f, void_amount: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pos-tx">Jumlah Transaksi</Label>
              <Input id="pos-tx" type="number" min={1} value={form.transaction_count ?? 1} onChange={(e) => setForm((f) => ({ ...f, transaction_count: Number(e.target.value) }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-method">Payment Method</Label>
              <Input id="pos-method" value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pos-cashier">Kasir</Label>
              <Input id="pos-cashier" value={form.cashier ?? ""} onChange={(e) => setForm((f) => ({ ...f, cashier: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-shift">Shift</Label>
              <Input id="pos-shift" value={form.shift ?? ""} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Menyimpan..." : "Simpan"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}