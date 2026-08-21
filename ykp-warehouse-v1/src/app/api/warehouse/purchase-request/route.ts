/**
 * Purchase Request API per brief §11.
 * Converts recommendations into formal purchase requests.
 * Status: DRAFT → SUBMITTED → APPROVED → ORDERED → RECEIVED | CANCELLED
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertItem } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { FraudControlError, assertNotSelfApproval } from '@/lib/fraud-controls';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'purchase_request')) return unauthorized('Forbidden');

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    const header = await findRow(TABS.purchaseRequest, 'purchase_request_id', id);
    if (!header) return notFound('Purchase request not found');
    const items = await readTab<Record<string, string>>(TABS.purchaseRequestItem);
    return ok({ header: header.row, items: items.filter((r) => r.purchase_request_id === id) });
  }
  const headers = await readTab<Record<string, string>>(TABS.purchaseRequest);
  return list(headers);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'purchase_request')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string; outlet_id?: string; location_id?: string;
    required_by_date?: string; priority?: string; notes?: string;
    recommendation_ids?: string[];
    items?: Array<{
      item_id: string; requested_qty: number; purchase_unit: string;
      estimated_unit_price: number; preferred_supplier_id?: string;
      reason?: string; source_recommendation_id?: string;
    }>;
  };

  // If recommendation_ids provided, load them as items
  let items = body.items ?? [];
  if (body.recommendation_ids && body.recommendation_ids.length > 0) {
    const allRecs = await readTab<Record<string, string>>(TABS.purchaseRecommendation);
    for (const recId of body.recommendation_ids) {
      const rec = allRecs.find((r) => r.recommendation_id === recId);
      if (!rec) continue;
      items.push({
        item_id: rec.item_id,
        requested_qty: Number(rec.rounded_purchase_qty || rec.suggested_purchase_qty || 0),
        purchase_unit: rec.purchase_unit,
        estimated_unit_price: Number(rec.estimated_unit_price || 0),
        preferred_supplier_id: rec.supplier_id,
        reason: rec.reason,
        source_recommendation_id: recId
      });
    }
  }

  if (items.length === 0) return badRequest('At least one item or recommendation_id is required');

  try {
    for (const it of items) await assertItem(it.item_id);
  } catch (e) {
    if (e instanceof MissingRefError) return badRequest(e.message);
    throw e;
  }

  const now = nowTimestampWib();
  const prId = nextSequentialIdSync('PRQ');
  const today = formatDateWib(new Date());
  const totalValue = items.reduce((sum, it) => sum + (it.requested_qty * it.estimated_unit_price), 0);

  const header: Record<string, string> = {
    purchase_request_id: prId,
    request_number: prId,
    date: today,
    brand_id: body.brand_id ?? '',
    outlet_id: body.outlet_id ?? '',
    location_id: body.location_id ?? '',
    requested_by: s.userId,
    required_by_date: body.required_by_date ?? '',
    priority: body.priority ?? 'MEDIUM',
    estimated_total_value: String(Math.round(totalValue)),
    status: 'SUBMITTED',
    approved_by: '',
    approved_at: '',
    purchasing_pic: '',
    notes: body.notes ?? '',
    created_at: now,
    updated_at: now
  };
  await appendRows(TABS.purchaseRequest, [header]);

  const detailRows: Record<string, string>[] = [];
  for (const it of items) {
    const itemId = nextSequentialIdSync('PRI');
    detailRows.push({
      request_item_id: itemId,
      purchase_request_id: prId,
      item_id: it.item_id,
      requested_qty: String(it.requested_qty),
      purchase_unit: it.purchase_unit,
      estimated_unit_price: String(it.estimated_unit_price),
      estimated_total: String(Math.round(it.requested_qty * it.estimated_unit_price)),
      preferred_supplier_id: it.preferred_supplier_id ?? '',
      reason: it.reason ?? '',
      source_recommendation_id: it.source_recommendation_id ?? ''
    });

    // Mark recommendation as PURCHASE_REQUEST_CREATED
    if (it.source_recommendation_id) {
      const recFound = await findRow(TABS.purchaseRecommendation, 'recommendation_id', it.source_recommendation_id);
      if (recFound) {
        await updateRow(TABS.purchaseRecommendation, recFound.rowNumber, {
          ...recFound.row, recommendation_status: 'PURCHASE_REQUEST_CREATED'
        }).catch(() => null);
      }
    }
  }
  await appendRows(TABS.purchaseRequestItem, detailRows);

  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'purchase_request',
    recordId: prId, afterValue: JSON.stringify({ header, items: detailRows }),
    userId: s.userId
  }).catch(() => null);

  return ok({ header, items: detailRows }, 201);
});

/** Approve / reject / order purchase request */
export const PUT = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as {
    purchase_request_id: string;
    action: 'approve' | 'reject' | 'order' | 'cancel';
    notes?: string;
  };
  if (!body.purchase_request_id || !body.action) return badRequest('purchase_request_id and action required');

  const found = await findRow(TABS.purchaseRequest, 'purchase_request_id', body.purchase_request_id);
  if (!found) return notFound('Purchase request not found');

  const now = nowTimestampWib();
  let newStatus = found.row.status;

  if (body.action === 'approve') {
    if (!can(s.role as Role, 'approve', 'purchase_request')) return unauthorized('Forbidden');
    if (found.row.status !== 'SUBMITTED' && found.row.status !== 'DRAFT') {
      return badRequest(`Cannot approve from status ${found.row.status}`);
    }
    // Fraud control: segregation of duties — requester cannot approve own PR.
    try {
      assertNotSelfApproval(found.row.requested_by, s.userId, 'purchase_request');
    } catch (e) {
      if (e instanceof FraudControlError) return badRequest(e.message);
      throw e;
    }
    newStatus = 'APPROVED';
  } else if (body.action === 'reject') {
    if (!can(s.role as Role, 'approve', 'purchase_request')) return unauthorized('Forbidden');
    try {
      assertNotSelfApproval(found.row.requested_by, s.userId, 'purchase_request');
    } catch (e) {
      if (e instanceof FraudControlError) return badRequest(e.message);
      throw e;
    }
    newStatus = 'REJECTED';
  } else if (body.action === 'order') {
    if (!can(s.role as Role, 'update', 'purchase_request')) return unauthorized('Forbidden');
    if (found.row.status !== 'APPROVED') return badRequest('Must be APPROVED before ordering');
    newStatus = 'ORDERED';
  } else if (body.action === 'cancel') {
    newStatus = 'CANCELLED';
  } else {
    return badRequest(`Unknown action: ${body.action}`);
  }

  const updated = {
    ...found.row,
    status: newStatus,
    approved_by: body.action === 'approve' || body.action === 'reject' ? s.userId : found.row.approved_by,
    approved_at: body.action === 'approve' || body.action === 'reject' ? now : found.row.approved_at,
    notes: body.notes ?? found.row.notes,
    updated_at: now
  };
  await updateRow(TABS.purchaseRequest, found.rowNumber, updated);

  await logAudit({
    module: 'warehouse', action: body.action, recordType: 'purchase_request',
    recordId: body.purchase_request_id,
    beforeValue: JSON.stringify(found.row), afterValue: JSON.stringify(updated),
    userId: s.userId
  }).catch(() => null);

  return ok(updated);
});
