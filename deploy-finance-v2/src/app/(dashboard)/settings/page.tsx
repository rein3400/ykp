/**
 * Settings page — master data viewers + threshold config + Telegram test.
 */
"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Tabs, TabsList, TabsTrigger, TabsContent } from "../../../../_packages/ui/src";
import { useBrands, useExpenseCategories, useOutlets, usePaymentMethods, usePettyCashAccounts, useSuppliers } from "../../../features/finance/api/queries";
import { useTelegramTest } from "../../../features/finance/api/mutations";
import { Send } from "lucide-react";

export default function SettingsPage() {
  const brands = useBrands();
  const outlets = useOutlets();
  const suppliers = useSuppliers();
  const categories = useExpenseCategories();
  const paymentMethods = usePaymentMethods();
  const pettyCashAccounts = usePettyCashAccounts();
  const telegram = useTelegramTest();

  const [message, setMessage] = React.useState("Test message dari YKP Finance");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      <Tabs defaultValue="brands">
        <TabsList>
          <TabsTrigger value="brands">Brand</TabsTrigger>
          <TabsTrigger value="outlets">Outlet</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier</TabsTrigger>
          <TabsTrigger value="categories">Category</TabsTrigger>
          <TabsTrigger value="methods">Payment Method</TabsTrigger>
          <TabsTrigger value="accounts">Petty Cash Account</TabsTrigger>
        </TabsList>

        <TabsContent value="brands">
          <Card><CardHeader><CardTitle>Master Brand</CardTitle></CardHeader><CardContent><MasterTable rows={brands.data ?? []} cols={["brandId","brandName","brandCode","status"]} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="outlets">
          <Card><CardHeader><CardTitle>Master Outlet</CardTitle></CardHeader><CardContent><MasterTable rows={outlets.data ?? []} cols={["outletId","outletName","brandId","status"]} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="suppliers">
          <Card><CardHeader><CardTitle>Master Supplier</CardTitle></CardHeader><CardContent><MasterTable rows={suppliers.data ?? []} cols={["supplierId","supplierName","category","status"]} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="categories">
          <Card><CardHeader><CardTitle>Expense Category</CardTitle></CardHeader><CardContent><MasterTable rows={categories.data ?? []} cols={["categoryId","categoryName","accountType","status"]} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="methods">
          <Card><CardHeader><CardTitle>Payment Method</CardTitle></CardHeader><CardContent><MasterTable rows={paymentMethods.data ?? []} cols={["methodId","methodName","isCash","status"]} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="accounts">
          <Card><CardHeader><CardTitle>Petty Cash Account</CardTitle></CardHeader><CardContent><MasterTable rows={pettyCashAccounts.data ?? []} cols={["accountId","accountName","outletId","currency","status"]} /></CardContent></Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle>Threshold Config (stub)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Outlet Expense Limit (IDR)</Label>
              <Input type="number" defaultValue={5_000_000} />
            </div>
            <div className="grid gap-2">
              <Label>Petty Cash Auto-Approve (IDR)</Label>
              <Input type="number" defaultValue={500_000} />
            </div>
          </div>
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

function MasterTable({ rows, cols }: { rows: Record<string, unknown>[]; cols: string[] }) {
  if (!rows.length) return <div className="text-muted-foreground">Tidak ada data.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {cols.map((c) => <th key={c} className="px-2 py-2">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b">
              {cols.map((c) => <td key={c} className="px-2 py-2">{String(r[c] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}