/**
 * Shareholding updates (owner only): change an investor's profit-share %.
 * POST — upserts the current shareholding row AND appends an
 *        effective-dated share_history row (dividends use the pct valid
 *        for the period, not today's pct).
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, forbidden, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, todayWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (s.role !== 'owner') return forbidden('Only owner can change shareholding');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const investorId = (body.investor_id ?? '').trim();
  const brandId = (body.brand_id ?? '').trim();
  const sharePct = Number(body.share_pct ?? NaN);
  const effectiveDate = body.effective_date || todayWib();
  if (!investorId || !brandId) return badRequest('investor_id dan brand_id wajib diisi');
  if (!Number.isFinite(sharePct) || sharePct <= 0 || sharePct > 100) {
    return badRequest('share_pct harus angka 0–100');
  }
  const investor = await findRow(TABS.investors, 'investor_id', investorId);
  if (!investor) return notFound(`Investor tidak ditemukan: ${investorId}`);

  const now = nowTimestampWib();
  const all = await readTab<Record<string, string>>(TABS.shareholding);
  const existing = all.find((r) => r.investor_id === investorId && r.brand_id === brandId);

  let before = '';
  if (existing) {
    before = JSON.stringify(existing);
    const found = await findRow(TABS.shareholding, 'share_id', existing.share_id);
    if (found) {
      await updateRow(TABS.shareholding, found.rowNumber, {
        ...existing,
        share_pct: String(sharePct),
        valuation_date: effectiveDate,
        last_updated: now
      });
    }
  } else {
    await appendRows(TABS.shareholding, [{
      share_id: nextSequentialIdSync('SHR'),
      investor_id: investorId,
      brand_id: brandId,
      brand_name: body.brand_name ?? '',
      share_pct: String(sharePct),
      share_value: body.share_value ?? '',
      valuation_date: effectiveDate,
      last_updated: now
    }]);
  }

  await appendRows(TABS.shareHistory, [{
    hist_id: nextSequentialIdSync('SHH'),
    investor_id: investorId,
    brand_id: brandId,
    share_pct: String(sharePct),
    effective_date: effectiveDate,
    created_by: s.userId,
    created_at: now
  }]);

  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'update',
    entity: 'shareholding',
    entityId: `${investorId}/${brandId}`,
    beforeValue: before,
    afterValue: JSON.stringify({ share_pct: sharePct, effective_date: effectiveDate })
  }).catch(() => null);

  return ok({ investor_id: investorId, brand_id: brandId, share_pct: String(sharePct), effective_date: effectiveDate });
});
