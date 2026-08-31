/**
 * Waste — writes to warehouse_waste (new schema).
 * Photo still required. Phase 3 will expand with approval + auto ledger.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib, formatTimeWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { appendEvidenceRows, parseEvidenceUrls } from '@/lib/evidence';
import { FraudControlError, assertReason } from '@/lib/fraud-controls';
import { appendMovement } from '@/lib/stock-ledger';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = await readTab<Record<string, string>>(TABS.waste);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const evidenceFiles = parseEvidenceUrls(body.evidence_urls);
  const photoUrl = String(body.photo_url ?? evidenceFiles[0]?.url ?? '');
  // Business rule: waste wajib foto, tanpa foto = tidak diakui
  if (!photoUrl) {
    return badRequest('Waste wajib foto. Tanpa foto = tidak diakui.');
  }
  // Fraud control: reason mandatory (audit trail); waste is a classic
  // channel for disguising theft as spoilage.
  try {
    assertReason(typeof body.reason === 'string' ? body.reason : undefined);
  } catch (e) {
    if (e instanceof FraudControlError) return badRequest(e.message);
    throw e;
  }
  const id = nextSequentialIdSync('WST');
  const unitCost = Number(body.estimated_unit_cost || body.buy_price || 0);
  const qty = Number(body.qty || 0);
  // Ledger integrity: stock movements are keyed by (item, location). A waste
  // without a location cannot deduct from the ledger — previously the ledger
  // post silently failed ("Insufficient stock" swallowed), so stock never
  // decreased while the API returned 201. Location is now mandatory.
  const locationId = String(body.location_id ?? '');
  if (qty > 0 && body.item_id && !locationId) {
    return badRequest('location_id wajib untuk pengurangan stok waste (stok dilacak per lokasi).');
  }
  const row: Record<string, string> = {
    waste_id: id,
    waste_number: id,
    date: String(body.date ?? formatDateWib(new Date())),
    time: String(body.time ?? formatTimeWib(new Date())),
    brand_id: String(body.brand_id ?? ''),
    outlet_id: String(body.outlet_id ?? ''),
    location_id: String(body.location_id ?? ''),
    shift_id: String(body.shift_id ?? body.shift ?? ''),
    item_id: String(body.item_id ?? ''),
    menu_id: String(body.menu_id ?? ''),
    batch_reference: String(body.batch_reference ?? ''),
    qty: String(qty),
    unit: String(body.unit ?? ''),
    estimated_unit_cost: String(unitCost),
    estimated_total_value: String(unitCost * qty),
    waste_type: String(body.waste_type ?? 'OTHER'),
    reason: String(body.reason ?? ''),
    root_cause: String(body.root_cause ?? ''),
    photo_url: photoUrl,
    reported_by: String(body.reported_by ?? body.pic ?? s.userId),
    witness_by: String(body.witness_by ?? body.witness_signature ?? ''),
    approval_status: 'PENDING',
    approved_by: '',
    related_order_id: String(body.related_order_id ?? ''),
    related_incident_id: String(body.related_incident_id ?? ''),
    preventive_action: String(body.preventive_action ?? ''),
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.waste, [row]);
  // A waste MUST reduce ledger stock; a swallowed ledger failure here would
  // leave the API reporting success while inventory stays unchanged.
  if (qty > 0 && body.item_id) {
    try {
      await appendMovement({
        movementType: 'WASTE',
        direction: 'OUT',
        quantity: qty,
        baseUnit: String(body.unit ?? ''),
        unitCost,
        itemId: String(body.item_id),
        brandId: String(body.brand_id ?? ''),
        outletId: String(body.outlet_id ?? ''),
        locationId,
        referenceType: 'waste',
        referenceId: id,
        createdBy: s.userId,
        notes: `Waste ${id}: ${String(body.reason ?? '')}`
      });
    } catch (e) {
      console.error('[waste] ledger post failed:', e);
      return NextResponse.json(
        { error: { code: 'ledger_write_failed', message: `Waste tersimpan tapi stok GAGAL dikurangi: ${e instanceof Error ? e.message : 'ledger error'}. Hubungi admin untuk koreksi manual.` } },
        { status: 500 }
      );
    }
  }
  if (evidenceFiles.length) {
    await appendEvidenceRows('waste', id, evidenceFiles, s.userId).catch(
      (e) => console.error('[waste] evidence append failed:', e),
    );
  }
  await logAudit({
    module: 'warehouse',
    action: 'create',
    recordType: 'waste',
    recordId: id,
    afterValue: JSON.stringify(row),
    userId: s.userId
  }).catch(() => null);
  return ok({ ...row, evidence: evidenceFiles }, 201);
});
