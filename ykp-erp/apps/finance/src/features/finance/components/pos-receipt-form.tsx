/**
 * Dialog for creating an individual POS receipt (with optional photo nota).
 * Replaces the old daily-aggregate PosFormDialog for manual entry.
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
import { todayWib } from "@ykp/engine/client";
import { useCreatePosReceipt } from "../api/mutations";
import { useOutlets, usePaymentMethods, useBrands } from "../api/queries";
import type { CreatePosReceiptBody } from "../api/types";
import { PosPhotoUpload } from "./pos-photo-upload";

export function PosReceiptFormDialog() {
  const [open, setOpen] = React.useState(false);
  const { data: outlets = [] } = useOutlets();
  const { data: brands = [] } = useBrands();
  const { data: methods = [] } = usePaymentMethods();
  const create = useCreatePosReceipt();

  const [form, setForm] = React.useState({
    date: todayWib(),
    outlet_id: "",
    receipt_number: "",
    transaction_time: "",
    gross_sales: 0,
    discount: 0,
    refund: 0,
    void_amount: 0,
    tax: 0,
    service_charge: 0,
    payment_method_id: "",
    payment_amount: 0,
    transaction_count: 1,
    cashier: "",
    shift: "",
    notes: "",
  });
  const [photo, setPhoto] = React.useState<{ url: string; path: string } | undefined>();
  const [error, setError] = React.useState<string | null>(null);

  const selectedOutlet = outlets.find((o) => o.outletId === form.outlet_id);
  const brandName =
    brands.find((b) => b.brandId === selectedOutlet?.brandId)?.brandName ??
    selectedOutlet?.brandId ??
    "";

  const netPreview = Math.max(
    0,
    form.gross_sales - form.discount - form.refund - form.void_amount,
  );

  const canSubmit =
    !!form.date &&
    !!form.outlet_id &&
    !!form.receipt_number.trim() &&
    !!form.payment_method_id &&
    form.gross_sales > 0 &&
    form.payment_amount >= 0 &&
    !create.isPending;

  /** Human-readable list of missing/invalid required fields. */
  const missingFields = (): string[] => {
    const m: string[] = [];
    if (!form.date) m.push("Tanggal");
    if (!form.outlet_id) m.push("Outlet");
    if (!form.receipt_number.trim()) m.push("Nomor Nota");
    if (!form.payment_method_id) m.push("Metode Pembayaran");
    if (!(form.gross_sales > 0)) m.push("Gross Sales (> 0)");
    if (!(form.payment_amount >= 0)) m.push("Jumlah Bayar (>= 0)");
    return m;
  };

  const reset = () => {
    setForm({
      date: todayWib(),
      outlet_id: "",
      receipt_number: "",
      transaction_time: "",
      gross_sales: 0,
      discount: 0,
      refund: 0,
      void_amount: 0,
      tax: 0,
      service_charge: 0,
      payment_method_id: "",
      payment_amount: 0,
      transaction_count: 1,
      cashier: "",
      shift: "",
      notes: "",
    });
    setPhoto(undefined);
    setError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit || !selectedOutlet) {
      const missing = missingFields();
      setError(
        missing.length
          ? `Lengkapi dulu: ${missing.join(", ")}.`
          : "Pilih outlet yang valid.",
      );
      return;
    }

    const body: CreatePosReceiptBody = {
      date: form.date,
      brand_id: selectedOutlet.brandId,
      brand_name: brandName || selectedOutlet.brandId,
      outlet_id: selectedOutlet.outletId,
      outlet_name: selectedOutlet.outletName,
      receipt_number: form.receipt_number.trim(),
      transaction_time: form.transaction_time || undefined,
      gross_sales: form.gross_sales,
      discount: form.discount,
      refund: form.refund,
      void_amount: form.void_amount,
      tax: form.tax,
      service_charge: form.service_charge,
      payment_method_id: form.payment_method_id,
      payment_amount: form.payment_amount || form.gross_sales,
      payment_breakdown: {
        [form.payment_method_id]: form.payment_amount || form.gross_sales,
      },
      transaction_count: form.transaction_count || 1,
      cashier: form.cashier || undefined,
      shift: form.shift || undefined,
      notes: form.notes || undefined,
      source: "manual",
      photo_url: photo?.url,
      photo_path: photo?.path,
    };

    create.mutate(body, {
      onSuccess: () => {
        reset();
        setOpen(false);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Gagal menyimpan struk");
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Tambah Struk
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah Struk POS</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 py-2">
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rcpt-date">Tanggal</Label>
              <Input
                id="rcpt-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rcpt-time">Waktu Transaksi</Label>
              <Input
                id="rcpt-time"
                type="time"
                value={form.transaction_time}
                onChange={(e) => setForm((f) => ({ ...f, transaction_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rcpt-outlet">Outlet</Label>
            <Select
              value={form.outlet_id}
              onValueChange={(v) => setForm((f) => ({ ...f, outlet_id: v }))}
            >
              <SelectTrigger id="rcpt-outlet">
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

          <div className="grid gap-2">
            <Label htmlFor="rcpt-number">Nomor Nota</Label>
            <Input
              id="rcpt-number"
              value={form.receipt_number}
              onChange={(e) => setForm((f) => ({ ...f, receipt_number: e.target.value }))}
              placeholder="mis. MOKA-00123"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rcpt-gross">Gross Sales</Label>
              <Input
                id="rcpt-gross"
                type="number"
                min={0}
                value={form.gross_sales || ""}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setForm((f) => ({
                    ...f,
                    gross_sales: v,
                    payment_amount: f.payment_amount === 0 ? v : f.payment_amount,
                  }));
                }}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rcpt-discount">Discount</Label>
              <Input
                id="rcpt-discount"
                type="number"
                min={0}
                value={form.discount || ""}
                onChange={(e) => setForm((f) => ({ ...f, discount: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rcpt-refund">Refund</Label>
              <Input
                id="rcpt-refund"
                type="number"
                min={0}
                value={form.refund || ""}
                onChange={(e) => setForm((f) => ({ ...f, refund: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rcpt-void">Void</Label>
              <Input
                id="rcpt-void"
                type="number"
                min={0}
                value={form.void_amount || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, void_amount: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rcpt-tax">Tax</Label>
              <Input
                id="rcpt-tax"
                type="number"
                min={0}
                value={form.tax || ""}
                onChange={(e) => setForm((f) => ({ ...f, tax: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rcpt-service">Service Charge</Label>
              <Input
                id="rcpt-service"
                type="number"
                min={0}
                value={form.service_charge || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, service_charge: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Net (preview)</Label>
              <div className="rounded-md border bg-muted px-3 py-2 text-sm tabular-nums">
                {netPreview.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rcpt-method">Payment Method</Label>
              <Select
                value={form.payment_method_id}
                onValueChange={(v) => setForm((f) => ({ ...f, payment_method_id: v }))}
              >
                <SelectTrigger id="rcpt-method">
                  <SelectValue placeholder="Pilih metode" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.methodId} value={m.methodId}>
                      {m.methodName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rcpt-pay-amount">Payment Amount</Label>
              <Input
                id="rcpt-pay-amount"
                type="number"
                min={0}
                value={form.payment_amount || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, payment_amount: Number(e.target.value) || 0 }))
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rcpt-tx">Jumlah Tx</Label>
              <Input
                id="rcpt-tx"
                type="number"
                min={1}
                value={form.transaction_count}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    transaction_count: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rcpt-cashier">Kasir</Label>
              <Input
                id="rcpt-cashier"
                value={form.cashier}
                onChange={(e) => setForm((f) => ({ ...f, cashier: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rcpt-shift">Shift</Label>
              <Input
                id="rcpt-shift"
                value={form.shift}
                onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rcpt-notes">Catatan</Label>
            <Input
              id="rcpt-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {form.outlet_id && form.date ? (
            <PosPhotoUpload
              outletId={form.outlet_id}
              date={form.date}
              value={photo}
              onChange={setPhoto}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Pilih outlet + tanggal dulu untuk upload foto nota.
            </p>
          )}

          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Menyimpan..." : "Simpan Struk"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
