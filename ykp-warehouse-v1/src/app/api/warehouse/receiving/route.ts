/**
 * Receiving API — header+detail per brief §12.
 * POST creates warehouse_receiving + warehouse_receiving_item rows.
 * On APPROVED status: auto posts RECEIPT movement to stock ledger,
 * updates batch_stock, creates alert on discrepancy.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib, formatTimeWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertItem, assertSupplier, assertLocation } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { appendMovement } from '@/lib/stock-ledger';
import { evalReceivingDiscrepancy, shouldCreateAction } from '@/lib/rules-engine';
import { dispatchAlertTelegram } from '@/lib/telegram';
import { appendEvidenceRows, parseEvidenceUrls } from '@/lib/evidence';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'receiving')) return unauthorized('Forbidden');

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    const header = await findRow(TABS.receiving, 'receiving_id', id);
    if (!header) return notFound('Receiving not found');
    const items = await readTab<Record<string, string>>(TABS.receivingItem);
    const detail = items.filter((r) => r.receiving_id === id);
    return ok({ header: header.row, items: detail });
  }

  const headers = await readTab<Record<string, string>>(TABS.receiving);
  return list(headers);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'receiving')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as {
    source_type?: string; supplier_id?: string; source_location_id?: string;
    destination_location_id?: string; purchase_order_id?: string;
    invoice_number?: string; delivery_note_number?: string;
    received_by?: string; verified_by?: string; photo_url?: string; notes?: string;
    evidence_urls?: unknown;
    items?: Array<{
      item_id: string; batch_number?: string; expiry_date?: string;
      qty_ordered: number; qty_delivered: number; qty_accepted: number;
      qty_rejected?: number; unit: string; unit_price: number;
      rejection_reason?: string; condition_status?: string;
      temperature_value?: string; photo_url?: string; notes?: string;
    }>;
  };

  if (!body.items || body.items.length === 0) return badRequest('At least one item is required');

  // Validate FKs
  try {
    for (const it of body.items) await assertItem(it.item_id);
    if (body.supplier_id) await assertSupplier(body.supplier_id);
    if (body.destination_location_id) await assertLocation(body.destination_location_id);
    if (body.source_location_id) await assertLocation(body.source_location_id);
  } catch (e) {
    if (e instanceof MissingRefError) return badRequest(e.message);
    throw e;
  }

  const now = nowTimestampWib();
  const receivingId = nextSequentialIdSync('RCV');
  const today = formatDateWib(new Date());
  const nowTime = formatTimeWib(new Date());

  // Create header
  const header: Record<string, string> = {
    receiving_id: receivingId,
    receiving_number: receivingId,
    date: today,
    receiving_time: nowTime,
    source_type: body.source_type ?? 'SUPPLIER',
    supplier_id: body.supplier_id ?? '',
    source_location_id: body.source_location_id ?? '',
    destination_location_id: body.destination_location_id ?? '',
    purchase_order_id: body.purchase_order_id ?? '',
    invoice_number: body.invoice_number ?? '',
    delivery_note_number: body.delivery_note_number ?? '',
    received_by: body.received_by ?? s.userId,
    verified_by: body.verified_by ?? '',
    receiving_status: 'RECEIVED',
    photo_url: body.photo_url ?? '',
    notes: body.notes ?? '',
    created_at: now,
    approved_at: ''
  };
  await appendRows(TABS.receiving, [header]);

  // Create detail items
  const detailRows: Record<string, string>[] = [];
  let hasDiscrepancy = false;

  for (const it of body.items) {
    const itemId = nextSequentialIdSync('RCI');
    const qtyAccepted = it.qty_accepted ?? it.qty_delivered;
    const qtyRejected = it.qty_rejected ?? Math.max(0, (it.qty_delivered || 0) - qtyAccepted);
    const totalValue = String(Math.round(qtyAccepted * (it.unit_price || 0)));
    const condition = it.condition_status ?? 'GOOD';

    if (qtyAccepted < (it.qty_ordered || 0) || condition !== 'GOOD') {
      hasDiscrepancy = true;
    }

    const detail: Record<string, string> = {
      receiving_item_id: itemId,
      receiving_id: receivingId,
      item_id: it.item_id,
      batch_number: it.batch_number ?? '',
      expiry_date: it.expiry_date ?? '',
      qty_ordered: String(it.qty_ordered || 0),
      qty_delivered: String(it.qty_delivered || 0),
      qty_accepted: String(qtyAccepted),
      qty_rejected: String(qtyRejected),
      unit: it.unit,
      unit_price: String(it.unit_price || 0),
      total_value: totalValue,
      rejection_reason: it.rejection_reason ?? '',
      condition_status: condition,
      temperature_value: it.temperature_value ?? '',
      photo_url: it.photo_url ?? '',
      notes: it.notes ?? ''
    };
    detailRows.push(detail);
  }
  await appendRows(TABS.receivingItem, detailRows);

  // Update header status if discrepancy
  if (hasDiscrepancy) {
    const found = await findRow(TABS.receiving, 'receiving_id', receivingId);
    if (found) {
      await updateRow(TABS.receiving, found.rowNumber, { ...found.row, receiving_status: 'DISCREPANCY' });
      header.receiving_status = 'DISCREPANCY';
    }
  }

  // Auto-post ledger movements for accepted items
  for (const it of body.items) {
    const qtyAccepted = it.qty_accepted ?? it.qty_delivered;
    if (qtyAccepted > 0 && body.destination_location_id) {
      await appendMovement({
        movementType: 'RECEIPT',
        direction: 'IN',
        quantity: qtyAccepted,
        baseUnit: it.unit,
        unitCost: it.unit_price || 0,
        itemId: it.item_id,
        brandId: '',
        outletId: '',
        locationId: body.destination_location_id,
        referenceType: 'receiving',
        referenceId: receivingId,
        createdBy: s.userId,
        notes: `Receiving ${receivingId}`
      }).catch((e) => console.error('[receiving] ledger post failed:', e));
    }

    // Create alert on discrepancy
    if (qtyAccepted < (it.qty_ordered || 0) || (it.condition_status && it.condition_status !== 'GOOD')) {
      const alert = evalReceivingDiscrepancy(
        it.qty_ordered || 0, qtyAccepted, it.condition_status ?? 'GOOD',
        it.item_id, receivingId, it.item_id
      );
      if (alert) {
        const alertId = nextSequentialIdSync('ALR');
        const alertRow: Record<string, string> = {
          alert_id: alertId,
          alert_datetime: now,
          alert_type: alert.alertType,
          severity: alert.severity,
          brand_id: alert.brandId ?? '',
          outlet_id: alert.outletId ?? '',
          location_id: alert.locationId ?? '',
          item_id: alert.itemId ?? '',
          reference_type: alert.referenceType ?? 'receiving',
          reference_id: alert.referenceId ?? receivingId,
          title: alert.title,
          message: alert.message,
          status: 'OPEN',
          assigned_to: '',
          due_date: today,
          action_required: alert.actionRequired,
          telegram_status: 'QUEUED',
          created_at: now,
          resolved_at: '',
          resolved_by: ''
        };
        const startRow = await appendRows(TABS.alertLog, [alertRow]).catch(() => -1);
        await dispatchAlertTelegram({
          alertId,
          severity: alert.severity,
          alertType: alert.alertType,
          title: alert.title,
          message: alert.message,
          actionRequired: alert.actionRequired,
          startRow,
          alertRow,
        }).catch(() => null);

        // Auto-create action for HIGH/CRITICAL
        if (shouldCreateAction(alert.severity)) {
          const actionId = nextSequentialIdSync('ACT');
          const actionRow: Record<string, string> = {
            action_id: actionId,
            source_alert_id: alertId,
            title: alert.title,
            description: alert.message,
            brand_id: alert.brandId ?? '',
            outlet_id: alert.outletId ?? '',
            location_id: alert.locationId ?? '',
            item_id: alert.itemId ?? '',
            priority: alert.severity,
            assigned_to: '',
            assigned_role: 'purchasing',
            due_date: today,
            status: 'OPEN',
            action_taken: '',
            attachment_url: '',
            approved_by: '',
            created_at: now,
            updated_at: now,
            completed_at: ''
          };
          await appendRows(TABS.actionTracker, [actionRow]).catch(() => null);
        }
      }
    }
  }

  const evidenceFiles = parseEvidenceUrls(body.evidence_urls);
  if (evidenceFiles.length) {
    await appendEvidenceRows('receiving', receivingId, evidenceFiles, s.userId).catch(
      (e) => console.error('[receiving] evidence append failed:', e),
    );
    // Keep first photo on header for quick list display
    if (!header.photo_url && evidenceFiles[0]) {
      header.photo_url = evidenceFiles[0].url;
      const found = await findRow(TABS.receiving, 'receiving_id', receivingId);
      if (found) {
        await updateRow(TABS.receiving, found.rowNumber, {
          ...found.row,
          photo_url: evidenceFiles[0].url,
        }).catch(() => null);
      }
    }
  }

  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'receiving',
    recordId: receivingId, afterValue: JSON.stringify({ header, items: detailRows }),
    userId: s.userId
  }).catch(() => null);

  return ok({ header, items: detailRows, evidence: evidenceFiles }, 201);
});
