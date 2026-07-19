'use client';
import { useMemo, useState } from 'react';

/**
 * Dashboard Kontrol Bahan Baku — Excel sheet "Dashboard" 1:1.
 * 7 KPI mingguan + target/aktual/status + 3 temuan + 3 rencana aksi + Aturan Emas.
 */
export default function DashboardClient({
  closing, waste, items, receiving, stockIssue, ledger, posNetSales
}: {
  closing: Record<string, string>[];
  waste: Record<string, string>[];
  items: Record<string, string>[];
  receiving: Record<string, string>[];
  stockIssue: Record<string, string>[];
  ledger: Record<string, string>[];
  posNetSales: number;
}) {
  const [findings, setFindings] = useState(['', '', '']);
  const [actions, setActions] = useState(['', '', '']);

  const kpi = useMemo(() => {
    // 7 last closing dates
    const dates = Array.from(new Set(closing.map((c) => c.date))).sort().reverse().slice(0, 7);
    const weekClosing = closing.filter((c) => dates.includes(c.date));
    const weekWaste = waste.filter((w) => dates.includes(w.date) || dates.length === 0);
    const weekReceiving = receiving.filter((r) => dates.includes(r.date) || dates.length === 0);
    const weekIssue = stockIssue.filter((s) => dates.includes(s.date) || dates.length === 0);

    // 1. Avg daily stock variance %
    const pcts = weekClosing.map((c) => Number(c.diff_pct || c.variance_vs_book_percentage || 0));
    const avgDiff = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;

    // 2. Food cost % = (issue value + waste value) / POS net sales × 100.
    // Inventory usage value is the food COST; POS net sales (from finance) is
    // the denominator. Shows N/A only when there is no usage value at all.
    let issueValue = 0;
    for (const s of weekIssue) {
      const item = items.find((i) => i.item_id === s.item_id);
      const price = Number(item?.average_purchase_price || item?.latest_purchase_price || item?.buy_price || 0);
      issueValue += Number(s.qty_out || s.issued_qty || 0) * price;
    }
    // Also sum ISSUE movements from ledger
    for (const m of ledger) {
      if (m.movement_type === 'ISSUE' || m.movement_type === 'WASTE') {
        issueValue += Number(m.total_value || 0);
      }
    }
    // waste value feeds the food-cost numerator (issue + waste)
    let wasteValueForFoodCost = 0;
    for (const w of weekWaste) {
      wasteValueForFoodCost += Number(w.estimated_total_value || w.estimated_loss || 0);
    }
    const foodCostBase = issueValue + wasteValueForFoodCost;
    const foodCostPct = foodCostBase > 0 && posNetSales > 0
      ? (foodCostBase / posNetSales) * 100
      : null;

    // 3. Waste ratio = waste_value / (issue_value + waste_value)
    let wasteValue = 0;
    for (const w of weekWaste) {
      wasteValue += Number(w.estimated_total_value || w.estimated_loss || 0);
    }
    const usageBase = issueValue + wasteValue;
    const wasteRatio = usageBase > 0 ? (wasteValue / usageBase) * 100 : 0;

    // 4. Receiving accuracy = rows with difference=0 / total receiving
    const recvRows = weekReceiving.length
      ? weekReceiving
      : receiving;
    let accurate = 0;
    for (const r of recvRows) {
      const diff = Number(r.difference || 0);
      const ordered = Number(r.qty_order || r.qty_ordered || 0);
      const accepted = Number(r.qty_received || r.qty_accepted || 0);
      if (diff === 0 && (ordered === 0 || accepted >= ordered)) accurate++;
      else if (ordered > 0 && accepted === ordered) accurate++;
    }
    const recvAccuracy = recvRows.length > 0 ? (accurate / recvRows.length) * 100 : 100;

    // 5. Form compliance F1-F5: days with at least one of each form type / 7
    const hasRecv = new Set(receiving.map((r) => r.date)).size;
    const hasIssue = new Set(stockIssue.map((s) => s.date)).size;
    const hasWaste = new Set(waste.map((w) => w.date)).size;
    const hasClose = dates.length;
    const hasLedger = new Set(ledger.map((m) => (m.movement_datetime || '').slice(0, 10))).size;
    // Compliance = average of form types that have data this week vs expected 5 forms
    const formsWithData = [hasRecv > 0, hasIssue > 0, hasWaste >= 0, hasClose > 0, hasLedger > 0].filter(Boolean).length;
    // If no transactions at all, compliance is N/A (show 0 with note)
    const totalTx = receiving.length + stockIssue.length + waste.length + closing.length + ledger.length;
    const formCompliance = totalTx === 0 ? 0 : Math.min(100, (formsWithData / 5) * 100);

    // 6. Total variance value (Rp)
    let totalDiffValue = 0;
    for (const c of weekClosing) {
      const item = items.find((i) => i.item_id === c.item_id);
      const price = Number(item?.average_purchase_price || item?.latest_purchase_price || item?.buy_price || 0);
      const diffQty = Math.abs(Number(c.difference || c.variance_vs_book_qty || 0));
      totalDiffValue += diffQty * price;
      // Prefer explicit variance value if present
      if (c.variance_vs_book_value) totalDiffValue = Math.max(totalDiffValue, Number(c.variance_vs_book_value));
    }

    // 7. Audit count — use ledger movements as proxy for "audit trail activity" this week
    const auditCount = ledger.filter((m) => {
      const d = (m.movement_datetime || '').slice(0, 10);
      return dates.length === 0 || dates.includes(d);
    }).length;

    // Auto findings
    const autoFindings: string[] = [];
    if (avgDiff > 2) autoFindings.push(`Avg selisih stok ${avgDiff.toFixed(1)}% melebihi target ≤2%`);
    if (wasteRatio > 2) autoFindings.push(`Waste ratio ${wasteRatio.toFixed(1)}% melebihi target ≤2%`);
    if (recvAccuracy < 100 && recvRows.length > 0) autoFindings.push(`Akurasi penerimaan ${recvAccuracy.toFixed(0)}% — ada discrepancy`);
    const alertClosing = weekClosing.filter((c) => Number(c.diff_pct || 0) > 5);
    if (alertClosing.length > 0) {
      const top = alertClosing.reduce((a, b) => Number(a.diff_pct || 0) > Number(b.diff_pct || 0) ? a : b);
      autoFindings.push(`Item selisih terbesar: ${top.item_name || top.item_id} (${top.diff_pct}%)`);
    }

    // Auto action plans
    const autoActions: string[] = [];
    if (avgDiff > 2) autoActions.push('Lakukan stock opname harian untuk item CRITICAL/HIGH');
    if (wasteRatio > 2) autoActions.push('Review root cause waste dan preventive action PIC outlet');
    if (recvAccuracy < 100) autoActions.push('Klaim receiving discrepancy ke supplier hari ini');
    if (autoActions.length === 0) autoActions.push('Pertahankan compliance F1–F5 100% minggu depan');

    return {
      avg_daily_diff_pct: avgDiff,
      food_cost_pct: foodCostPct as number | null,
      waste_ratio_pct: wasteRatio,
      receiving_accuracy_pct: recvAccuracy,
      form_compliance_pct: formCompliance,
      total_diff_value: totalDiffValue,
      waste_value: wasteValue,
      audit_count: auditCount,
      closing_count: dates.length,
      closing_dates: dates,
      autoFindings: autoFindings.slice(0, 3),
      autoActions: autoActions.slice(0, 3),
      totalTx
    };
  }, [closing, waste, items, receiving, stockIssue, ledger]);

  const kpis = [
    { label: 'Selisih stok rata-rata harian per item', value: `${kpi.avg_daily_diff_pct.toFixed(1)}%`, target: '≤ 2%', ok: kpi.avg_daily_diff_pct <= 2 },
    { label: 'Food cost % vs sales', value: kpi.food_cost_pct === null ? 'N/A (butuh POS)' : `${kpi.food_cost_pct.toFixed(1)}%`, target: '28% – 35%', ok: undefined },
    { label: 'Waste ratio (% dari pemakaian)', value: `${kpi.waste_ratio_pct.toFixed(1)}%`, target: '≤ 2%', ok: kpi.waste_ratio_pct <= 2 },
    { label: 'Akurasi penerimaan barang', value: `${kpi.receiving_accuracy_pct.toFixed(0)}%`, target: '100%', ok: kpi.receiving_accuracy_pct >= 100 },
    { label: 'Compliance form F1–F5', value: `${kpi.form_compliance_pct.toFixed(0)}%`, target: '100%', ok: kpi.form_compliance_pct >= 100 },
    { label: 'Total nilai selisih minggu ini (Rp)', value: formatRp(kpi.total_diff_value), target: 'Rp 0', ok: kpi.total_diff_value === 0 },
    { label: 'Jumlah audit/movement minggu ini', value: String(kpi.audit_count), target: '≥ 1×', ok: kpi.audit_count >= 1 }
  ];

  return (
    <div className='space-y-4'>
      <div className='rounded border border-border bg-background p-3'>
        <p className='text-xs font-semibold mb-2'>KPI MINGGU INI</p>
        <div className='overflow-x-auto'>
          <table className='w-full text-xs'>
            <thead className='bg-muted text-muted-foreground'>
              <tr>
                <th className='px-2 py-1 text-left'>KPI</th>
                <th className='px-2 py-1 text-left'>Target</th>
                <th className='px-2 py-1 text-right'>Aktual</th>
                <th className='px-2 py-1 text-left'>Status</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <tr key={k.label} className='border-t border-border'>
                  <td className='px-2 py-1'>{k.label}</td>
                  <td className='px-2 py-1 text-muted-foreground'>{k.target}</td>
                  <td className='px-2 py-1 text-right font-medium'>{k.value}</td>
                  <td className='px-2 py-1'>
                    {k.ok === true && <span className='rounded bg-green-100 text-green-800 px-1 text-[10px] font-medium'>OK</span>}
                    {k.ok === false && <span className='rounded bg-red-100 text-red-800 px-1 text-[10px] font-medium'>ALERT</span>}
                    {k.ok === undefined && <span className='rounded bg-gray-100 text-gray-600 px-1 text-[10px]'>N/A</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {kpi.totalTx === 0 && (
          <p className='mt-2 text-[10px] text-muted-foreground'>Belum ada transaksi. KPI akan terisi setelah receiving/issue/waste/opname dicatat.</p>
        )}
      </div>

      <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
        <div className='rounded border border-border bg-background p-3'>
          <p className='text-xs font-semibold mb-2'>3 TEMUAN UTAMA MINGGU INI</p>
          {(kpi.autoFindings.length ? kpi.autoFindings : ['(belum ada temuan otomatis)']).map((f, i) => (
            <p key={i} className='text-xs mb-1'>{i + 1}. {f}</p>
          ))}
          <div className='mt-2 space-y-1'>
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                placeholder={`Temuan manual ${i + 1}`}
                value={findings[i]}
                onChange={(e) => { const c = [...findings]; c[i] = e.target.value; setFindings(c); }}
                className='w-full rounded border border-border px-2 py-1 text-[10px]'
              />
            ))}
          </div>
        </div>
        <div className='rounded border border-border bg-background p-3'>
          <p className='text-xs font-semibold mb-2'>3 RENCANA AKSI MINGGU DEPAN</p>
          {(kpi.autoActions.length ? kpi.autoActions : ['Pertahankan compliance F1–F5']).map((a, i) => (
            <p key={i} className='text-xs mb-1'>{i + 1}. {a}</p>
          ))}
          <div className='mt-2 space-y-1'>
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                placeholder={`Rencana aksi ${i + 1}`}
                value={actions[i]}
                onChange={(e) => { const c = [...actions]; c[i] = e.target.value; setActions(c); }}
                className='w-full rounded border border-border px-2 py-1 text-[10px]'
              />
            ))}
          </div>
        </div>
      </div>

      <div className='rounded border border-border bg-background p-3'>
        <p className='text-xs text-muted-foreground mb-2'>Tanggal Closing Tercatat (7 terakhir):</p>
        <div className='flex flex-wrap gap-1'>
          {kpi.closing_dates.length === 0
            ? <span className='text-xs text-muted-foreground'>Belum ada closing.</span>
            : kpi.closing_dates.map((d) => <span key={d} className='rounded bg-muted px-2 py-0.5 text-xs'>{d}</span>)}
        </div>
      </div>

      <AturanEmas />
    </div>
  );
}

function AturanEmas() {
  return (
    <div className='rounded border border-amber-300 bg-amber-50 p-3 text-xs'>
      <p className='font-semibold mb-1'>Aturan Emas</p>
      <ol className='list-decimal pl-4 space-y-1'>
        <li>Tidak ada tanda tangan = barang tidak diterima.</li>
        <li>Tidak ada bon F3 = bahan tidak boleh keluar dari gudang.</li>
        <li>Tidak ada foto F4 = waste tidak diakui (jadi tanggung jawab PIC).</li>
        <li>Tidak ada closing F5 = outlet tidak boleh buka besok.</li>
        <li>Selisih &gt; 5% per item = wajib investigasi 24 jam (unexplained stock variance dulu, bukan LOST).</li>
      </ol>
    </div>
  );
}

function formatRp(n: number) {
  if (!n) return 'Rp 0';
  return `Rp ${new Intl.NumberFormat('id-ID').format(Math.trunc(n))}`;
}
