/**
 * Ringkasan Finance — dashboard utama. KPI cards dan chart trend.
 * Cards row membaca real /api/fin/summary. Chart panels di bawah
 * adalah empty-state placeholder sampai komponen chart terpasang;
 * tidak ada nilai dummy yang hardcoded agar finance tim tidak
 * salah membaca angka contoh sebagai data produksi.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@ykp/ui";
import { FinanceDashboardCards } from "@finance/features/finance/components/finance-dashboard-cards";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Ringkasan Finance</h2>
        <p className="text-sm text-muted-foreground">
          Posisi kas, revenue, dan ringkasan harian per outlet. Default-nya hari ini; rentang tanggal
          dapat disesuaikan dari filter halaman <strong>Analytics</strong>.
        </p>
      </div>

      <FinanceDashboardCards />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Trend revenue 7 hari akan dirender di sini setelah endpoint analytics terhubung.</p>
            <p className="text-muted-foreground">Belum ada data chart.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expense Donut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Distribusi expense per kategori akan dirender di sini.</p>
            <p className="text-muted-foreground">Belum ada data chart.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Supplier Top 10</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Ranking 10 supplier terbesar per periode akan dirender di sini.</p>
            <p className="text-muted-foreground">Belum ada data chart.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
