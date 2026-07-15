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
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Chart revenue 7 hari akan tersedia setelah data POS masuk. Import CSV Moka atau catat
              transaksi manual untuk melihat tren.
            </p>
            <a
              href="/pos"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Buka POS Revenue
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expense Donut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Distribusi expense per kategori akan muncul setelah data pengeluaran dicatat. Tambah
              expense untuk melihat breakdown.
            </p>
            <a
              href="/expenses"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Buka Expense Log
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Supplier Top 10</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Ranking supplier akan tersedia setelah fitur procurement aktif. Pantau halaman ini
              untuk update selanjutnya.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
