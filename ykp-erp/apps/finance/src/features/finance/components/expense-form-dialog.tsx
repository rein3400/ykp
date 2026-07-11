"use client";

/**
 * ExpenseFormDialog — Self-contained "Tambah Expense" form.
 * Pattern mirrors PosFormDialog: DialogTrigger button + form with
 * outlet/category/payment-method selects from master data queries.
 * Submits via useCreateExpense → POST /api/fin/expense.
 */

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
import { todayWib } from "@ykp/engine/client";
import { useCreateExpense } from "../api/mutations";
import { useOutlets, useExpenseCategories, usePaymentMethods } from "../api/queries";

export function ExpenseFormDialog() {
  const [open, setOpen] = React.useState(false);
  const { data: outlets = [] } = useOutlets();
  const { data: categories = [] } = useExpenseCategories();
  const { data: methods = [] } = usePaymentMethods();
  const create = useCreateExpense();

  const [form, setForm] = React.useState({
    date: todayWib(),
    outlet_id: "",
    category_id: "",
    payment_method_id: "",
    description: "",
    amount: 0,
    notes: "",
  });

  const canSubmit =
    !!form.date &&
    !!form.outlet_id &&
    !!form.category_id &&
    !!form.payment_method_id &&
    form.amount > 0 &&
    !create.isPending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    create.mutate(form, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="exp-date">Tanggal</Label>
            <Input
              id="exp-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-outlet">Outlet</Label>
            <Select
              value={form.outlet_id}
              onValueChange={(v) => setForm((f) => ({ ...f, outlet_id: v }))}
            >
              <SelectTrigger id="exp-outlet">
                <SelectValue placeholder="Pilih outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets.map((o: any) => (
                  <SelectItem key={o.outletId ?? o.outlet_id} value={o.outletId ?? o.outlet_id}>
                    {o.outletName ?? o.outlet_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-category">Kategori</Label>
            <Select
              value={form.category_id}
              onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
            >
              <SelectTrigger id="exp-category">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => (
                  <SelectItem
                    key={c.categoryId ?? c.category_id}
                    value={c.categoryId ?? c.category_id}
                  >
                    {c.categoryName ?? c.category_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-method">Payment Method</Label>
            <Select
              value={form.payment_method_id}
              onValueChange={(v) => setForm((f) => ({ ...f, payment_method_id: v }))}
            >
              <SelectTrigger id="exp-method">
                <SelectValue placeholder="Pilih metode" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m: any) => (
                  <SelectItem
                    key={m.methodId ?? m.method_id}
                    value={m.methodId ?? m.method_id}
                  >
                    {m.methodName ?? m.method_name}
                    {(m.isCash ?? m.is_cash) ? " (Cash)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-amount">Jumlah (IDR)</Label>
            <Input
              id="exp-amount"
              type="number"
              min={1}
              value={form.amount || ""}
              onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
              placeholder="0"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-desc">Deskripsi</Label>
            <Input
              id="exp-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="mis. Pembelian ATK outlet OL-001"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-notes">Catatan (opsional)</Label>
            <Input
              id="exp-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Catatan internal"
            />
          </div>

          <Button type="submit" disabled={!canSubmit}>
            {create.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}