/**
 * Settings page — master data viewers + threshold config + Telegram test.
 */
"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Tabs, TabsList, TabsTrigger, TabsContent } from "@ykp/ui";
import { useBrands, useExpenseCategories, useOutlets, usePaymentMethods, usePettyCashAccounts, useSuppliers } from "@finance/features/finance/api/queries";
import { useTelegramTest } from "@finance/features/finance/api/mutations";
import { Send } from "lucide-react";

type SettingsTab =
  | "brands"
  | "outlets"
  | "suppliers"
  | "categories"
  | "methods"
  | "accounts";

export default function SettingsPage() {
  const brands = useBrands();
  const outlets = useOutlets();
  const suppliers = useSuppliers();
  const categories = useExpenseCategories();
  const paymentMethods = usePaymentMethods();
  const pettyCashAccounts = usePettyCashAccounts();
  const telegram = useTelegramTest();

  const [message, setMessage] = React.useState("Test message dari YKP Finance");
  // Controlled tabs — uncontrolled Radix defaultValue was observed stuck on
  // Brand in production (clicks update aria briefly then re-render resets).
  const [tab, setTab] = React.useState<SettingsTab>("brands");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
        <TabsList>
          <TabsTrigger value="brands">Brand</TabsTrigger>
          <TabsTrigger value="outlets">Outlet</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier</TabsTrigger>
          <TabsTrigger value="categories">Category</TabsTrigger>
          <TabsTrigger value="methods">Payment Method</TabsTrigger>
          <TabsTrigger value="accounts">Petty Cash Account</TabsTrigger>
        </TabsList>

        <TabsContent value="brands">
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
        </TabsContent>
        <TabsContent value="outlets">
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
        </TabsContent>
        <TabsContent value="suppliers">
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
        </TabsContent>
        <TabsContent value="categories">
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
        </TabsContent>
        <TabsContent value="methods">
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
        </TabsContent>
        <TabsContent value="accounts">
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
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle>Threshold Config</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Threshold configuration moved to Hermez → Config
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Telegram Test Send</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button onClick={() => telegram.mutate(message)} disabled={telegram.isPending}>
              <Send className="mr-2 h-4 w-4" /> {telegram.isPending ? "Mengirim..." : "Kirim"}
            </Button>
          </div>
          {telegram.data ? (
            <p className="mt-3 text-sm text-success">Terkirim. message_id={telegram.data.message_id}</p>
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