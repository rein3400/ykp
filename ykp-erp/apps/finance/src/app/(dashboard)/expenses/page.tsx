/**
 * Expense log page — CRUD + approval. KPI by category & outlet.
 * Filter bar: date range, brand (cascades outlet), category, approval status.
 */
"use client";

import * as React from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
  ExportButton, KpiCard, formatIdr,
  Button, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@ykp/ui";
import { ExpenseTable } from "@finance/features/finance/components/expense-table";
import { ExpenseFormDialog } from "@finance/features/finance/components/expense-form-dialog";
import { useExpenseList, useBrands, useOutlets, useExpenseCategories } from "@finance/features/finance/api/queries";
import { useApproveExpense, useExportCsv, useExportPdf } from "@finance/features/finance/api/mutations";
import { todayWib } from "@ykp/engine/client";
import type { Expense } from "@finance/features/finance/api/types";

const ALL = "__all__";

const APPROVAL_OPTIONS = [
  { value: ALL, label: "Semua Status" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

export default function ExpensesPage() {
  const today = todayWib();
  const monthStart = `${today.slice(0, 7)}-01`;

  // ---- master data ----
  const { data: brands = [] } = useBrands();
  const { data: allOutlets = [] } = useOutlets();
  const { data: categories = [] } = useExpenseCategories();

  // ---- filter form state (what the user is editing) ----
  // Empty string = no filter for that field. Radix Select can't take value=""
  // so the dropdowns use ALL sentinel; we translate back below.
  const [form, setForm] = React.useState({
    dateFrom: monthStart,
    dateTo: today,
    brandId: "",
    outletId: "",
    categoryId: "",
    approvalStatus: "",
  });

  // ---- applied filter state (what is actually queried) ----
  const [filters, setFilters] = React.useState({ ...form });

  const applyFilters = () => setFilters({ ...form });

  // Cascade: outlets filtered by selected brand
  const outlets = React.useMemo(() => {
    if (!form.brandId) return allOutlets;
    return allOutlets.filter((o: any) => (o.brandId ?? o.brand_id) === form.brandId);
  }, [allOutlets, form.brandId]);

  // Build query params from applied filters
  const params = React.useMemo(() => {
    const p = new URLSearchParams();
    if (filters.dateFrom) p.set("date_from", filters.dateFrom);
    if (filters.dateTo) p.set("date_to", filters.dateTo);
    if (filters.outletId) p.set("outlet_id", filters.outletId);
    if (filters.categoryId) p.set("category_id", filters.categoryId);
    if (filters.approvalStatus) p.set("approval_status", filters.approvalStatus);
    return p;
  }, [filters]);

  // Translate form select values (ALL sentinel) to empty-string for storage
  const sel = (v: string) => (v === ALL ? "" : v);

  const { data = [] } = useExpenseList(params);
  const rows = data as Expense[];

  const total = rows.reduce((acc, r) => acc + (r.amount ?? 0), 0);
  const approve = useApproveExpense();
  const exportPdf = useExportPdf();
  const exportCsv = useExportCsv();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Expense Log</h2>
        <div className="flex items-center gap-2">
          <ExportButton
            onExportPdf={async () => { await exportPdf.mutateAsync({ report: "expense", date_from: filters.dateFrom, date_to: filters.dateTo, filters: {} }); }}
            onExportCsv={async () => { await exportCsv.mutateAsync({ report: "expense", date_from: filters.dateFrom, date_to: filters.dateTo, filters: {} }); }}
          />
          <ExpenseFormDialog />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard title="Total MTD" value={formatIdr(total)} />
        <KpiCard title="Jumlah Transaksi" value={rows.length} />
      </div>

      {/* ---- Filter bar ---- */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-6 items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="flt-date-from">Dari</Label>
              <Input
                id="flt-date-from"
                type="date"
                value={form.dateFrom}
                onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="flt-date-to">Sampai</Label>
              <Input
                id="flt-date-to"
                type="date"
                value={form.dateTo}
                onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="flt-brand">Brand</Label>
              <Select
                value={form.brandId || ALL}
                onValueChange={(v) => setForm((f) => ({ ...f, brandId: sel(v), outletId: "" }))}
              >
                <SelectTrigger id="flt-brand">
                  <SelectValue placeholder="Semua Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua Brand</SelectItem>
                  {brands.map((b: any) => (
                    <SelectItem key={b.brandId ?? b.brand_id} value={b.brandId ?? b.brand_id}>
                      {b.brandName ?? b.brand_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="flt-outlet">Outlet</Label>
              <Select
                value={form.outletId || ALL}
                onValueChange={(v) => setForm((f) => ({ ...f, outletId: sel(v) }))}
              >
                <SelectTrigger id="flt-outlet">
                  <SelectValue placeholder="Semua Outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua Outlet</SelectItem>
                  {outlets.map((o: any) => (
                    <SelectItem key={o.outletId ?? o.outlet_id} value={o.outletId ?? o.outlet_id}>
                      {o.outletName ?? o.outlet_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="flt-category">Kategori</Label>
              <Select
                value={form.categoryId || ALL}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryId: sel(v) }))}
              >
                <SelectTrigger id="flt-category">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua Kategori</SelectItem>
                  {categories.map((c: any) => (
                    <SelectItem key={c.categoryId ?? c.category_id} value={c.categoryId ?? c.category_id}>
                      {c.categoryName ?? c.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="flt-status">Status</Label>
              <Select
                value={form.approvalStatus || ALL}
                onValueChange={(v) => setForm((f) => ({ ...f, approvalStatus: sel(v) }))}
              >
                <SelectTrigger id="flt-status">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={applyFilters}>Filter</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Daftar Expense</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-sm text-muted-foreground max-w-md">
                Belum ada pengeluaran. Tambah pengeluaran untuk memulai pencatatan.
              </p>
              <ExpenseFormDialog />
            </div>
          ) : (
            <ExpenseTable params={params} onApprove={(r) => approve.mutate({ id: r.expenseId, body: { decision: "APPROVE" } })} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}