/**
 * Transfer Stock API — header+detail per brief §14.
 * Status flow: DRAFT → REQUESTED → APPROVED → DISPATCHED → RECEIVED | DISCREPANCY | CANCELLED
 * Rule: Transfer Out reduces stock only on DISPATCHED; Transfer In adds only on RECEIVED.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { badRequest, fail, forbidden, handler, list, notFound, ok, unauthorized } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertItem, assertLocation } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { appendMovement } from '@/lib/stock-ledger';
import { normalizeUnit } from '@/lib/unit-conversion';
import { evalTransferDiscrepancy, shouldCreateAction } from '@/lib/rules-engine';
import { dispatchAlertTelegram } from '@/lib/telegram';
import { appendEvidenceRows, parseEvidenceUrls } from '@/lib/evidence';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'transfer')) return forbidden();

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    const header = await findRow(TABS.transfer, 'transfer_id', id);
    if (!header) return notFound('Transfer not found');
    const items = await readTab<Record<string, string>>(TABS.transferItem);
    return ok({ header: header.row, items: items.filter((r) => r.transfer_id === id) });
  }
  const headers = await readTab<Record<string, string>>(TABS.transfer);
  return list(headers);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'transfer')) return forbidden();

  const body = (await req.json().catch(() => ({}))) as {
    source_location_id?: string; destination_location_id?: string;
    notes?: string;
    evidence_urls?: unknown;
    items?: Array<{
      item_id: string; requested_qty: number; unit: string;
    }>;
  };

  if (!body.source_location_id || !body.destination_location_id) {
    return badRequest('source_location_id and destination_location_id are required');
  }
  if (!body.items || body.items.length === 0) return badRequest('At least one item is required');

  try {
    await assertLocation(body.source_location_id);
    await assertLocation(body.destination_location_id);
    for (const it of body.items) await assertItem(it.item_id);
  } catch (e) {
    if (e instanceof MissingRefError) return badRequest(e.message);
    throw e;
  }

  const now = nowTimestampWib();
  const transferId = nextSequentialIdSync('TRF');
  const today = formatDateWib(new Date());

  const header: Record<string, string> = {
    transfer_id: transferId,
    transfer_number: transferId,
    date: today,
    source_location_id: body.source_location_id,
    destination_location_id: body.destination_location_id,
    requested_by: s.userId,
    approved_by: '',
    dispatched_by: '',
    received_by: '',
    dispatch_time: '',
    received_time: '',
    status: 'REQUESTED',
    notes: body.notes ?? '',
    created_at: now,
    updated_at: now
  };
  await appendRows(TABS.transfer, [header]);

  const detailRows: Record<string, string>[] = [];
  for (const it of body.items) {
    const itemId = nextSequentialIdSync('TRI');
    detailRows.push({
      transfer_item_id: itemId,
      transfer_id: transferId,
      item_id: it.item_id,
      requested_qty: String(it.requested_qty || 0),
      dispatched_qty: '0',
      received_qty: '0',
      unit: it.unit,
      discrepancy_qty: '0',
      discrepancy_reason: '',
      photo_url: ''
    });
  }
  await appendRows(TABS.transferItem, detailRows);

  const evidenceFiles = parseEvidenceUrls(body.evidence_urls);
  if (evidenceFiles.length) {
    await appendEvidenceRows('transfer', transferId, evidenceFiles, s.userId).catch(
      (e) => console.error('[transfer] evidence append failed:', e),
    );
  }

  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'transfer',
    recordId: transferId, afterValue: JSON.stringify({ header, items: detailRows }),
    userId: s.userId
  }).catch(() => null);

  return ok({ header, items: detailRows, evidence: evidenceFiles }, 201);
});

/**
 * PUT — status transitions: approve, dispatch, receive.
 * Body: { transfer_id, action: 'approve'|'dispatch'|'receive', items?: [{item_id, qty}] }
 */
export const PUT = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as {
    transfer_id: string;
    action: 'approve' | 'dispatch' | 'receive' | 'cancel';
    items?: Array<{ transfer_item_id?: string; item_id: string; qty: number; discrepancy_reason?: string }>;
  };
  if (!body.transfer_id || !body.action) return badRequest('transfer_id and action required');

  const found = await findRow(TABS.transfer, 'transfer_id', body.transfer_id);
  if (!found) return notFound('Transfer not found');
  const header = found.row;
  const now = nowTimestampWib();
  const allItems = await readTab<Record<string, string>>(TABS.transferItem);
  const items = allItems.filter((r) => r.transfer_id === body.transfer_id);
  const submittedLine = (item: Record<string, string>) => body.items?.find(row =>
    row.transfer_item_id ? row.transfer_item_id === item.transfer_item_id : row.item_id === item.item_id
  );
  if (body.items?.some(row => !row.transfer_item_id && items.filter(item => item.item_id === row.item_id).length > 1)) {
    return badRequest('transfer_item_id wajib untuk item yang muncul di beberapa baris');
  }

  if (body.action === 'dispatch' || body.action === 'receive') {
    if (!can(s.role as Role, 'update', 'transfer')) return forbidden();
    const dispatch = body.action === 'dispatch';
    const type = dispatch ? 'TRANSFER_OUT' : 'TRANSFER_IN';
    const leg = dispatch ? 'OUT' : 'IN';
    const location = dispatch ? header.source_location_id : header.destination_location_id;
    const movements = await readTab<Record<string, string>>(TABS.stockMovement);
    for (const item of items) {
      const qty = submittedLine(item)?.qty ?? Number(dispatch ? item.requested_qty : item.dispatched_qty);
      if (!Number.isFinite(qty) || qty < 0) return badRequest('Qty wajib finite dan nonnegatif');
      const existing = movements.filter(row => row.reference_type === 'transfer' && row.movement_type === type && row.item_id === item.item_id &&
        [body.transfer_id, `${body.transfer_id}-${leg}-${item.transfer_item_id}`].includes(row.reference_id));
      if (existing.length === 0) continue;
      const ambiguous = existing.some(row => row.reference_id === body.transfer_id) && items.filter(row => row.item_id === item.item_id).length > 1;
      if (ambiguous || existing.length !== 1 || Number(existing[0].quantity) !== qty ||
        normalizeUnit(existing[0].base_unit ?? '') !== normalizeUnit(item.unit) || existing[0].location_id !== location) {
        return fail('ledger_conflict', 'Posting ledger lama tidak cocok atau ambigu; rekonsiliasi diperlukan sebelum melanjutkan transfer.', 409);
      }
    }
  }

  if (body.action === 'approve') {
    if (!can(s.role as Role, 'approve', 'transfer')) return forbidden();
    if (header.status !== 'REQUESTED' && header.status !== 'DRAFT') {
      return badRequest(`Cannot approve from status ${header.status}`);
    }
    const updated = { ...header, status: 'APPROVED', approved_by: s.userId, updated_at: now };
    await updateRow(TABS.transfer, found.rowNumber, updated);
    await logAudit({
      module: 'warehouse', action: 'approve', recordType: 'transfer',
      recordId: body.transfer_id, beforeValue: JSON.stringify(header),
      afterValue: JSON.stringify(updated), userId: s.userId, approvalUserId: s.userId
    }).catch(() => null);
    return ok(updated);
  }

  if (body.action === 'dispatch') {
    if (!can(s.role as Role, 'update', 'transfer')) return forbidden();
    if (header.status !== 'APPROVED') return badRequest(`Cannot dispatch from status ${header.status}`);

    // Ledger is the source of truth: post one TRANSFER_OUT per line before the
    // status advances, so a failed post can never look like a successful move.
    // Reference ids are per line and per leg; OUT and IN used to share the
    // transfer id, which made the second leg fail the duplicate guard.
    const movements = await readTab<Record<string, string>>(TABS.stockMovement);
    const alreadyPosted = (movementType: string, itemId: string, referenceId: string) =>
      movements.some(
        (m) =>
          m.reference_type === 'transfer' &&
          m.movement_type === movementType &&
          m.item_id === itemId &&
          (m.reference_id === referenceId || m.reference_id === body.transfer_id),
      );

    for (const it of items) {
      const qty = submittedLine(it)?.qty ?? Number(it.requested_qty);
      if (qty <= 0) continue;
      const referenceId = `${body.transfer_id}-OUT-${it.transfer_item_id}`;
      if (alreadyPosted('TRANSFER_OUT', it.item_id, referenceId)) continue;
      try {
        await appendMovement({
          movementType: 'TRANSFER_OUT',
          direction: 'OUT',
          quantity: qty,
          baseUnit: normalizeUnit(it.unit),
          unitCost: 0,
          itemId: it.item_id,
          brandId: '',
          outletId: '',
          locationId: header.source_location_id,
          referenceType: 'transfer',
          referenceId,
          sourceLocationId: header.source_location_id,
          destinationLocationId: header.destination_location_id,
          createdBy: s.userId,
          notes: `Transfer dispatch ${body.transfer_id}`
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Ledger post failed';
        console.error('[transfer] dispatch ledger failed:', message);
        const status = /Insufficient stock/i.test(message) ? 409 : 500;
        return fail(
          'ledger_reconciliation_required',
          `Posting stok keluar gagal untuk ${it.item_id}: ${message}. Status transfer tidak diubah; perbaiki saldo lalu ulangi.`,
          status
        );
      }
    }

    for (const it of items) {
      const qty = submittedLine(it)?.qty ?? Number(it.requested_qty);
      const itemFound = await findRow(TABS.transferItem, 'transfer_item_id', it.transfer_item_id);
      if (itemFound) {
        await updateRow(TABS.transferItem, itemFound.rowNumber, {
          ...itemFound.row, dispatched_qty: String(qty)
        });
      }
    }

    const updated = {
      ...header, status: 'DISPATCHED', dispatched_by: s.userId,
      dispatch_time: now, updated_at: now
    };
    await updateRow(TABS.transfer, found.rowNumber, updated);
    await logAudit({
      module: 'warehouse', action: 'dispatch', recordType: 'transfer',
      recordId: body.transfer_id, afterValue: JSON.stringify(updated), userId: s.userId
    }).catch(() => null);
    return ok(updated);
  }

  if (body.action === 'receive') {
    if (!can(s.role as Role, 'update', 'transfer')) return forbidden();
    if (header.status !== 'DISPATCHED' && header.status !== 'PARTIAL_RECEIVED') {
      return badRequest(`Cannot receive from status ${header.status}`);
    }

    // Post TRANSFER_IN per line (own reference id) before touching item rows or
    // status, so a rejected post never reads as a completed receipt.
    const movements = await readTab<Record<string, string>>(TABS.stockMovement);
    const alreadyPosted = (itemId: string, referenceId: string) =>
      movements.some(
        (m) =>
          m.reference_type === 'transfer' &&
          m.movement_type === 'TRANSFER_IN' &&
          m.item_id === itemId &&
          (m.reference_id === referenceId || m.reference_id === body.transfer_id),
      );
    for (const it of items) {
      const qty = submittedLine(it)?.qty ?? Number(it.dispatched_qty);
      if (qty <= 0) continue;
      const referenceId = `${body.transfer_id}-IN-${it.transfer_item_id}`;
      if (alreadyPosted(it.item_id, referenceId)) continue;
      try {
        await appendMovement({
          movementType: 'TRANSFER_IN',
          direction: 'IN',
          quantity: qty,
          baseUnit: normalizeUnit(it.unit),
          unitCost: 0,
          itemId: it.item_id,
          brandId: '',
          outletId: '',
          locationId: header.destination_location_id,
          referenceType: 'transfer',
          referenceId,
          sourceLocationId: header.source_location_id,
          destinationLocationId: header.destination_location_id,
          createdBy: s.userId,
          notes: `Transfer receive ${body.transfer_id}`
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Ledger post failed';
        console.error('[transfer] receive ledger failed:', message);
        return fail(
          'ledger_reconciliation_required',
          `Posting stok masuk gagal untuk ${it.item_id}: ${message}. Status transfer tidak diubah; ulangi setelah diperbaiki.`,
          500
        );
      }
    }

    let hasDiscrepancy = false;
    for (const it of items) {
      const qty = submittedLine(it)?.qty ?? Number(it.dispatched_qty);
      const dispatched = Number(it.dispatched_qty);
      const discrepancy = qty - dispatched;
      if (discrepancy !== 0) hasDiscrepancy = true;

      const itemFound = await findRow(TABS.transferItem, 'transfer_item_id', it.transfer_item_id);
      if (itemFound) {
        await updateRow(TABS.transferItem, itemFound.rowNumber, {
          ...itemFound.row,
          received_qty: String(qty),
          discrepancy_qty: String(discrepancy),
          discrepancy_reason: submittedLine(it)?.discrepancy_reason ?? ''
        });
      }

      // Alert on discrepancy
      if (discrepancy !== 0) {
        const alert = evalTransferDiscrepancy(dispatched, qty, it.item_id, body.transfer_id, it.item_id);
        if (alert) {
          const alertId = nextSequentialIdSync('ALR');
          const alertRow: Record<string, string> = {
            alert_id: alertId, alert_datetime: now, alert_type: alert.alertType,
            severity: alert.severity, brand_id: '', outlet_id: '',
            location_id: header.destination_location_id, item_id: it.item_id,
            reference_type: 'transfer', reference_id: body.transfer_id,
            title: alert.title, message: alert.message, status: 'OPEN',
            assigned_to: '', due_date: formatDateWib(new Date()),
            action_required: alert.actionRequired, telegram_status: 'QUEUED',
            created_at: now, resolved_at: '', resolved_by: ''
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
        }
      }
    }

    const updated = {
      ...header,
      status: hasDiscrepancy ? 'DISCREPANCY' : 'RECEIVED',
      received_by: s.userId, received_time: now, updated_at: now
    };
    await updateRow(TABS.transfer, found.rowNumber, updated);
    await logAudit({
      module: 'warehouse', action: 'receive', recordType: 'transfer',
      recordId: body.transfer_id, afterValue: JSON.stringify(updated), userId: s.userId
    }).catch(() => null);
    return ok(updated);
  }

  if (body.action === 'cancel') {
    if (!can(s.role as Role, 'update', 'transfer')) return forbidden();
    if (['RECEIVED', 'DISPATCHED', 'CANCELLED'].includes(header.status)) {
      return badRequest(`Cannot cancel from status ${header.status}`);
    }
    const updated = { ...header, status: 'CANCELLED', updated_at: now };
    await updateRow(TABS.transfer, found.rowNumber, updated);
    return ok(updated);
  }

  return badRequest(`Unknown action: ${body.action}`);
});
