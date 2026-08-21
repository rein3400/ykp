/**
 * Stock Adjustment API per brief §16.2.
 * POST creates warehouse_stock_adjustment. Requires approval.
 * On APPROVED: posts COUNT_ADJUSTMENT movement to stock ledger.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertItem, assertLocation } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { appendMovement } from '@/lib/stock-ledger';
import { FraudControlError, assertNotSelfApproval, assertReason } from '@/lib/fraud-controls';

const ADJUSTMENT_TYPES = ['COUNT_CORRECTION', 'UNIT_CONVERSION_FIX', 'OPENING_BALANCE_FIX', 'SYSTEM_ERROR_FIX', 'OTHER'];

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'adjustment')) return unauthorized('Forbidden');
  const rows = await readTab<Record<string, string>>(TABS.adjustment);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'adjustment')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.item_id) return badRequest('item_id is required');
  if (!body.location_id) return badRequest('location_id is required');
  if (!body.adjustment_type || !ADJUSTMENT_TYPES.includes(body.adjustment_type)) {
    return badRequest(`adjustment_type must be one of: ${ADJUSTMENT_TYPES.join(', ')}`);
  }
  if (!body.qty_difference) return badRequest('qty_difference is required');
  // Invariant §2: integer IDR; reject non-numeric so NaN never reaches the ledger.
  if (!Number.isFinite(Number(body.qty_difference))) {
    return badRequest('qty_difference must be a finite number');
  }

  // Fraud control: reason is mandatory for the audit trail.
  try {
    assertReason(body.reason);
  } catch (e) {
    if (e instanceof FraudControlError) return badRequest(e.message);
    throw e;
  }

  try {
    await assertItem(body.item_id);
    await assertLocation(body.location_id);
  } catch (e) {
    if (e instanceof MissingRefError) return badRequest(e.message);
    throw e;
  }

  const id = nextSequentialIdSync('ADJ');
  const now = nowTimestampWib();
  // Fraud control: client-supplied approved_by is IGNORED. Adjustments always
  // start PENDING and only the PUT approve handler (with SoD check) can
  // approve. Previously `approved_by` in the POST body auto-approved —
  // a direct stock-manipulation fraud vector.
  const row: Record<string, string> = {
    adjustment_id: id,
    date: formatDateWib(new Date()),
    item_id: body.item_id,
    location_id: body.location_id,
    adjustment_type: body.adjustment_type,
    qty_difference: body.qty_difference,
    unit: body.unit ?? '',
    reason: body.reason,
    reference_count_id: body.reference_count_id ?? '',
    requested_by: s.userId,
    approved_by: '',
    approval_status: 'PENDING',
    created_at: now
  };
  await appendRows(TABS.adjustment, [row]);

  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'adjustment',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);

  return ok(row, 201);
});

/** Approve a pending adjustment */
export const PUT = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'approve', 'adjustment')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as { adjustment_id: string; approved: boolean; reason?: string };
  if (!body.adjustment_id) return badRequest('adjustment_id is required');

  const found = await findRow(TABS.adjustment, 'adjustment_id', body.adjustment_id);
  if (!found) return notFound('Adjustment not found');
  if (found.row.approval_status !== 'PENDING') return badRequest('Adjustment is not in PENDING status');

  // Fraud control: segregation of duties — requester cannot approve own adjustment.
  try {
    assertNotSelfApproval(found.row.requested_by, s.userId, 'adjustment');
    if (!body.approved) assertReason(body.reason, 'rejection reason');
  } catch (e) {
    if (e instanceof FraudControlError) return badRequest(e.message);
    throw e;
  }

  const newStatus = body.approved ? 'APPROVED' : 'REJECTED';
  const updated = {
    ...found.row,
    approval_status: newStatus,
    approved_by: s.userId,
    reason: body.reason ?? found.row.reason
  };
  await updateRow(TABS.adjustment, found.rowNumber, updated);

  if (newStatus === 'APPROVED') {
    const qtyDiff = Number(found.row.qty_difference);
    // Guard: never post a non-finite quantity to the ledger (corrupts the chain).
    if (!Number.isFinite(qtyDiff)) {
      return badRequest('qty_difference is not a finite number — cannot post to ledger');
    }
    await appendMovement({
      movementType: 'COUNT_ADJUSTMENT',
      direction: 'ADJUSTMENT',
      quantity: qtyDiff,
      baseUnit: found.row.unit,
      unitCost: 0,
      itemId: found.row.item_id,
      brandId: '',
      outletId: '',
      locationId: found.row.location_id,
      referenceType: 'adjustment',
      referenceId: body.adjustment_id,
      createdBy: found.row.requested_by,
      approvedBy: s.userId,
      notes: `${found.row.adjustment_type}: ${found.row.reason}`
    }).catch((e) => console.error('[adjustment] ledger post failed:', e));
  }

  await logAudit({
    module: 'warehouse', action: 'approve', recordType: 'adjustment',
    recordId: body.adjustment_id,
    beforeValue: JSON.stringify(found.row), afterValue: JSON.stringify(updated),
    userId: s.userId, approvalUserId: s.userId
  }).catch(() => null);

  return ok(updated);
});
