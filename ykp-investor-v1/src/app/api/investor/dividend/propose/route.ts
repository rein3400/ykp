/**
 * Dividend proposals (owner only).
 * POST { period: 'YYYY-MM' } — for each active investor × brand shareholding,
 * amount = brand net profit (fin_daily_summary.net_profit_estimate, finance
 * spreadsheet) × share_pct valid at period end (share_history, falling back
 * to current shareholding). Creates dividend rows with status 'proposed';
 * owner then declares/pays via PUT /api/investor/dividend.
 * Existing dividends for the same (investor, period) are skipped.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, readFinanceTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';

/** Latest share_pct for (investor, brand) effective at `asOf` (YYYY-MM-DD). */
function pctAt(
  history: Record<string, string>[],
  current: Record<string, string>[],
  investorId: string,
  brandId: string,
  asOf: string
): number {
  const hist = history
    .filter((h) => h.investor_id === investorId && h.brand_id === brandId && h.effective_date <= asOf)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  if (hist.length > 0) return Number(hist[0].share_pct || 0);
  const cur = current.find((c) => c.investor_id === investorId && c.brand_id === brandId);
  return cur ? Number(cur.share_pct || 0) : 0;
}

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner') return forbidden('Only owner can propose dividends');

  const body = (await req.json().catch(() => ({}))) as { period?: string };
  const period = (body.period ?? '').trim();
  if (!/^\d{4}-\d{2}$/.test(period)) return badRequest('period harus format YYYY-MM');
  const periodEnd = `${period}-31`; // works for lexicographic compare

  let finRows: Record<string, string>[] = [];
  try {
    finRows = await readFinanceTab<Record<string, string>>('fin_daily_summary');
  } catch {
    return badRequest('Finance spreadsheet tidak terkonfigurasi / tidak terbaca');
  }
  const profitByBrand = new Map<string, number>();
  for (const r of finRows) {
    if (!(r.date ?? '').startsWith(period)) continue;
    const bid = r.brand_id || '(unknown)';
    profitByBrand.set(bid, (profitByBrand.get(bid) ?? 0) + Number(r.net_profit_estimate || 0));
  }
  if (profitByBrand.size === 0) return badRequest(`Tidak ada data fin_daily_summary untuk periode ${period}`);

  const [investors, shareholding, history, dividends] = await Promise.all([
    readTab<Record<string, string>>(TABS.investors),
    readTab<Record<string, string>>(TABS.shareholding),
    readTab<Record<string, string>>(TABS.shareHistory),
    readTab<Record<string, string>>(TABS.dividend)
  ]);

  const now = nowTimestampWib();
  const created: Record<string, string>[] = [];
  const skipped: { investor_id: string; reason: string }[] = [];

  for (const inv of investors.filter((i) => i.status === 'active')) {
    const brands = new Set([
      ...shareholding.filter((sh) => sh.investor_id === inv.investor_id).map((sh) => sh.brand_id),
      ...history.filter((h) => h.investor_id === inv.investor_id).map((h) => h.brand_id)
    ]);
    let amount = 0;
    for (const brandId of brands) {
      const pct = pctAt(history, shareholding, inv.investor_id, brandId, periodEnd);
      const profit = profitByBrand.get(brandId) ?? 0;
      amount += Math.round((profit * pct) / 100);
    }
    if (amount <= 0) {
      skipped.push({ investor_id: inv.investor_id, reason: 'jumlah dividen ≤ 0 (profit/pct)' });
      continue;
    }
    if (dividends.some((d) => d.investor_id === inv.investor_id && d.period === period) ||
        created.some((d) => d.investor_id === inv.investor_id && d.period === period)) {
      skipped.push({ investor_id: inv.investor_id, reason: `dividen periode ${period} sudah ada` });
      continue;
    }
    const row = {
      dividend_id: nextSequentialIdSync('DVD'),
      investor_id: inv.investor_id,
      period,
      amount: String(amount),
      status: 'proposed',
      declared_at: '',
      paid_at: '',
      reference: `auto-propose ${period}`,
      created_at: now
    };
    created.push(row);
  }

  if (created.length > 0) await appendRows(TABS.dividend, created);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'dividend_propose',
    entityId: period,
    afterValue: JSON.stringify({ period, proposed: created.length, skipped: skipped.length })
  }).catch(() => null);

  return ok({ period, proposed: created, skipped });
});
