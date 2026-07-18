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
    source_module: "",
    source_transaction_id: "",
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [success, setSuccess] = React.useState("");

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.date) e.date = "Tanggal wajib diisi";
    if (!form.outlet_id) e.outlet_id = "Outlet wajib dipilih";
    if (!form.category_id) e.category_id = "Kategori wajib dipilih";
    if (!form.payment_method_id) e.payment_method_id = "Metode pembayaran wajib dipilih";
    if (!form.amount || form.amount <= 0) e.amount = "Jumlah harus lebih dari 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const canSubmit =
    !!form.date &&
    !!form.outlet_id &&
    !!form.category_id &&
    !!form.payment_method_id &&
    form.amount > 0 &&
    !create.isPending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccess("");
    if (!validate()) return;
    if (!canSubmit) return;
    create.mutate(form, {
      onSuccess: () => {
        setSuccess("Expense berhasil disimpan");
        setForm({
          date: todayWib(),
          outlet_id: "",
          category_id: "",
          payment_method_id: "",
          description: "",
          amount: 0,
          notes: "",
          source_module: "",
          source_transaction_id: "",
        });
        setTimeout(() => setOpen(false), 1200);
      },
      onError: (err) => {
        setErrors({ _form: err instanceof Error ? err.message : "Gagal menyimpan" });
      },
    });
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
          {success && (
            <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </div>
          )}
          {errors._form && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors._form}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="exp-date">Tanggal</Label>
            <Input
              id="exp-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
            {errors.date && <span className="text-xs text-red-600">{errors.date}</span>}
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
            {errors.outlet_id && <span className="text-xs text-red-600">{errors.outlet_id}</span>}
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
            {errors.category_id && <span className="text-xs text-red-600">{errors.category_id}</span>}
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
            {errors.payment_method_id && (
              <span className="text-xs text-red-600">{errors.payment_method_id}</span>
            )}
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
            {errors.amount && <span className="text-xs text-red-600">{errors.amount}</span>}
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

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="exp-source-mod">Source module (opsional)</Label>
              <Input
                id="exp-source-mod"
                value={form.source_module}
                onChange={(e) => setForm((f) => ({ ...f, source_module: e.target.value }))}
                placeholder="warehouse / ops / manual"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-source-tx">Source transaction id</Label>
              <Input
                id="exp-source-tx"
                value={form.source_transaction_id}
                onChange={(e) => setForm((f) => ({ ...f, source_transaction_id: e.target.value }))}
                placeholder="WST-001 / PR-003"
              />
            </div>
          </div>

          <Button type="submit" disabled={!canSubmit}>
            {create.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}