/**
 * Stock Issue API — header+detail per brief §13.
 * POST creates warehouse_stock_issue + warehouse_stock_issue_item rows.
 * On approved: auto posts ISSUE movement to stock ledger.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertItem, assertLocation } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { appendMovement } from '@/lib/stock-ledger';
import { appendEvidenceRows, parseEvidenceUrls } from '@/lib/evidence';
import { FraudControlError, assertNotSelfApproval } from '@/lib/fraud-controls';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'stock_issue')) return unauthorized('Forbidden');

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    const header = await findRow(TABS.stockIssue, 'issue_id', id);
    if (!header) return notFound('Stock issue not found');
    const items = await readTab<Record<string, string>>(TABS.stockIssueItem);
    const detail = items.filter((r) => r.issue_id === id);
    return ok({ header: header.row, items: detail });
  }

  const headers = await readTab<Record<string, string>>(TABS.stockIssue);
  return list(headers);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'stock_issue')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as {
    shift_id?: string; brand_id?: string; outlet_id?: string;
    source_location_id?: string; destination_location_id?: string;
    issue_type?: string; requested_by?: string; issued_by?: string;
    received_by?: string; notes?: string;
    evidence_urls?: unknown;
    items?: Array<{
      item_id: string; requested_qty: number; issued_qty: number;
      unit: string; batch_reference?: string; purpose?: string; notes?: string;
    }>;
  };

  if (!body.items || body.items.length === 0) return badRequest('At least one item is required');
  if (!body.source_location_id) return badRequest('source_location_id is required');

  try {
    for (const it of body.items) await assertItem(it.item_id);
    await assertLocation(body.source_location_id);
    if (body.destination_location_id) await assertLocation(body.destination_location_id);
  } catch (e) {
    if (e instanceof MissingRefError) return badRequest(e.message);
    throw e;
  }

  const now = nowTimestampWib();
  const issueId = nextSequentialIdSync('ISU');
  const today = formatDateWib(new Date());

  const requestedBy = body.requested_by ?? s.userId;
  const issuedBy = body.issued_by ?? s.userId;
  // Fraud control: segregation of duties — the person who requested the issue
  // cannot be the one who issues it. Brief permits auto-approve for internal
  // issues, but SoD is the fraud-control gate.
  try {
    assertNotSelfApproval(requestedBy, issuedBy, 'stock_issue');
  } catch (e) {
    if (e instanceof FraudControlError) return badRequest(e.message);
    throw e;
  }

  const header: Record<string, string> = {
    issue_id: issueId,
    issue_number: issueId,
    date: today,
    shift_id: body.shift_id ?? '',
    brand_id: body.brand_id ?? '',
    outlet_id: body.outlet_id ?? '',
    source_location_id: body.source_location_id,
    destination_location_id: body.destination_location_id ?? '',
    issue_type: body.issue_type ?? 'SHIFT_ISSUE',
    requested_by: requestedBy,
    issued_by: issuedBy,
    received_by: body.received_by ?? '',
    approval_status: 'APPROVED',
    notes: body.notes ?? '',
    created_at: now,
    approved_at: now
  };
  await appendRows(TABS.stockIssue, [header]);

  const detailRows: Record<string, string>[] = [];
  for (const it of body.items) {
    const itemId = nextSequentialIdSync('ISI');
    const detail: Record<string, string> = {
      issue_item_id: itemId,
      issue_id: issueId,
      item_id: it.item_id,
      requested_qty: String(it.requested_qty || 0),
      issued_qty: String(it.issued_qty || it.requested_qty || 0),
      unit: it.unit,
      batch_reference: it.batch_reference ?? '',
      purpose: it.purpose ?? '',
      notes: it.notes ?? ''
    };
    detailRows.push(detail);
  }
  await appendRows(TABS.stockIssueItem, detailRows);

  // Auto-post ledger: ISSUE from source, TRANSFER_IN to destination if applicable
  for (const it of body.items) {
    const issuedQty = it.issued_qty || it.requested_qty || 0;
    if (issuedQty <= 0) continue;

    // ISSUE from source
    await appendMovement({
      movementType: 'ISSUE',
      direction: 'OUT',
      quantity: issuedQty,
      baseUnit: it.unit,
      unitCost: 0,
      itemId: it.item_id,
      brandId: body.brand_id ?? '',
      outletId: body.outlet_id ?? '',
      locationId: body.source_location_id,
      referenceType: 'stock_issue',
      referenceId: issueId,
      createdBy: s.userId,
      notes: `Issue ${issueId}: ${it.purpose || ''}`
    }).catch((e) => console.error('[stock_issue] ledger post failed:', e));

    // If destination is a stock location, also post TRANSFER_IN
    if (body.destination_location_id) {
      await appendMovement({
        movementType: 'TRANSFER_IN',
        direction: 'IN',
        quantity: issuedQty,
        baseUnit: it.unit,
        unitCost: 0,
        itemId: it.item_id,
        brandId: body.brand_id ?? '',
        outletId: body.outlet_id ?? '',
        locationId: body.destination_location_id,
        referenceType: 'stock_issue',
        referenceId: issueId,
        createdBy: s.userId,
        notes: `Issue ${issueId} destination: ${it.purpose || ''}`
      }).catch((e) => console.error('[stock_issue] dest ledger post failed:', e));
    }
  }

  const evidenceFiles = parseEvidenceUrls(body.evidence_urls);
  if (evidenceFiles.length) {
    await appendEvidenceRows('stock_issue', issueId, evidenceFiles, s.userId).catch(
      (e) => console.error('[stock_issue] evidence append failed:', e),
    );
  }

  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'stock_issue',
    recordId: issueId, afterValue: JSON.stringify({ header, items: detailRows }),
    userId: s.userId
  }).catch(() => null);

  return ok({ header, items: detailRows, evidence: evidenceFiles }, 201);
});
