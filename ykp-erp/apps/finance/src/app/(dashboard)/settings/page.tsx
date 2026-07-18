/**
 * Settings page — master data viewers + threshold config + Telegram test.
 *
 * Tabs are plain buttons + conditional content (no Radix Tabs). Production
 * deep-tests showed Radix TabsTrigger stuck on Brand under synthetic clicks;
 * a simple state machine is more reliable for automation and SSR hydration.
 */
"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@ykp/ui";
import {
  useBrands,
  useExpenseCategories,
  useOutlets,
  usePaymentMethods,
  usePettyCashAccounts,
  useSuppliers,
} from "@finance/features/finance/api/queries";
import { useTelegramTest } from "@finance/features/finance/api/mutations";
import { Send } from "lucide-react";

type SettingsTab =
  | "brands"
  | "outlets"
  | "suppliers"
  | "categories"
  | "methods"
  | "accounts";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "brands", label: "Brand" },
  { id: "outlets", label: "Outlet" },
  { id: "suppliers", label: "Supplier" },
  { id: "categories", label: "Category" },
  { id: "methods", label: "Payment Method" },
  { id: "accounts", label: "Petty Cash Account" },
];

export default function SettingsPage() {
  const brands = useBrands();
  const outlets = useOutlets();
  const suppliers = useSuppliers();
  const categories = useExpenseCategories();
  const paymentMethods = usePaymentMethods();
  const pettyCashAccounts = usePettyCashAccounts();
  const telegram = useTelegramTest();

  const [message, setMessage] = React.useState("Test message dari YKP Finance");
  const [tab, setTab] = React.useState<SettingsTab>("brands");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      <div
        role="tablist"
        aria-label="Master data"
        className="inline-flex h-10 flex-wrap items-center justify-start gap-1 rounded-md bg-muted p-1 text-muted-foreground"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-state={active ? "active" : "inactive"}
              onClick={() => setTab(t.id)}
              className={
                active
                  ? "inline-flex items-center justify-center whitespace-nowrap rounded-sm bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
                  : "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium hover:text-foreground"
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "brands" && (
        <Card>
          <CardHeader>
            <CardTitle>Master Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <MasterTable
              rows={(brands.data ?? []) as Record<string, unknown>[]}
              cols={["brandId", "brandName", "brandCode", "status"]}
              idKey="brandId"
            />
          </CardContent>
        </Card>
      )}
      {tab === "outlets" && (
        <Card>
          <CardHeader>
            <CardTitle>Master Outlet</CardTitle>
          </CardHeader>
          <CardContent>
            <MasterTable
              rows={(outlets.data ?? []) as Record<string, unknown>[]}
              cols={["outletId", "outletName", "brandId", "status"]}
              idKey="outletId"
            />
          </CardContent>
        </Card>
      )}
      {tab === "suppliers" && (
        <Card>
          <CardHeader>
            <CardTitle>Master Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <MasterTable
              rows={(suppliers.data ?? []) as Record<string, unknown>[]}
              cols={["supplierId", "supplierName", "category", "status"]}
              idKey="supplierId"
            />
          </CardContent>
        </Card>
      )}
      {tab === "categories" && (
        <Card>
          <CardHeader>
            <CardTitle>Expense Category</CardTitle>
          </CardHeader>
          <CardContent>
            <MasterTable
              rows={(categories.data ?? []) as Record<string, unknown>[]}
              cols={["categoryId", "categoryName", "accountType", "status"]}
              idKey="categoryId"
            />
          </CardContent>
        </Card>
      )}
      {tab === "methods" && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <MasterTable
              rows={(paymentMethods.data ?? []) as Record<string, unknown>[]}
              cols={["methodId", "methodName", "isCash", "status"]}
              idKey="methodId"
            />
          </CardContent>
        </Card>
      )}
      {tab === "accounts" && (
        <Card>
          <CardHeader>
            <CardTitle>Petty Cash Account</CardTitle>
          </CardHeader>
          <CardContent>
            <MasterTable
              rows={(pettyCashAccounts.data ?? []) as Record<string, unknown>[]}
              cols={["accountId", "accountName", "outletId", "currency", "status"]}
              idKey="accountId"
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Threshold Config</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Threshold configuration moved to Hermez → Config
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telegram Test Send</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button onClick={() => telegram.mutate(message)} disabled={telegram.isPending}>
              <Send className="mr-2 h-4 w-4" /> {telegram.isPending ? "Mengirim..." : "Kirim"}
            </Button>
          </div>
          {telegram.data ? (
            <p className="mt-3 text-sm text-success">
              Terkirim. message_id={telegram.data.message_id}
            </p>
          ) : telegram.isError ? (
            <p className="mt-3 text-sm text-destructive">Gagal: {telegram.error?.message}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MasterTable({
  rows,
  cols,
  idKey,
}: {
  rows: Record<string, unknown>[];
  cols: string[];
  idKey?: string;
}) {
  if (!rows.length) {
    return <div className="text-sm text-muted-foreground">Tidak ada data.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {cols.map((c) => (
              <th key={c} className="px-2 py-2">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(idKey ? r[idKey] : i)} className="border-b">
              {cols.map((c) => (
                <td key={c} className="px-2 py-2">
                  {String(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
