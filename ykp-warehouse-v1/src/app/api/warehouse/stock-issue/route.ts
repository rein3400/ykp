/**
 * Stock Issue API — header+detail per brief §13.
 * POST creates warehouse_stock_issue + warehouse_stock_issue_item rows.
 * On approved: auto posts ISSUE movement to stock ledger.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, notFound, forbidden, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertItem, assertLocation } from '@/lib/repo';
import { can, scopeFilter, type Role } from '@/lib/rbac';
import { normalizeUnit } from '@/lib/unit-conversion';
import { appendMovement, bookStock } from '@/lib/stock-ledger';
import { appendEvidenceRows, parseEvidenceUrls } from '@/lib/evidence';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'stock_issue')) return unauthorized('Forbidden');

  const scope = scopeFilter(s.role as Role, s.brandId, s.outletId);
  if (['outlet_manager', 'supervisor', 'kitchen_lead', 'staff'].includes(s.role) && !scope.outletId) return forbidden();
  if (s.role === 'brand_manager' && !scope.brandId) return forbidden();
  const visible = (row: Record<string, string>) => (!scope.brandId || row.brand_id === scope.brandId) && (!scope.outletId || row.outlet_id === scope.outletId);
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    const header = await findRow(TABS.stockIssue, 'issue_id', id);
    if (!header || !visible(header.row)) return notFound('Stock issue not found');
    const items = await readTab<Record<string, string>>(TABS.stockIssueItem);
    const detail = items.filter((r) => r.issue_id === id);
    return ok({ header: header.row, items: detail });
  }

  const headers = await readTab<Record<string, string>>(TABS.stockIssue);
  return list(headers.filter(visible));
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

  if (!body || typeof body !== 'object') return badRequest('Payload tidak valid');
  if (!Array.isArray(body.items) || body.items.length === 0) return badRequest('At least one item is required');
  if (!body.source_location_id) return badRequest('source_location_id is required');
  if (body.destination_location_id && body.destination_location_id === body.source_location_id) return badRequest('Lokasi asal dan tujuan tidak boleh sama');
  for (const [index, item] of body.items.entries()) {
    if (!item || typeof item.item_id !== 'string' || !item.item_id.trim()) return badRequest(`Baris ${index + 1}: item wajib diisi`);
    const requested = Number(item.requested_qty);
    const issued = item.issued_qty === undefined || item.issued_qty === null ? requested : Number(item.issued_qty);
    if (!Number.isFinite(requested) || requested < 0) return badRequest(`Baris ${index + 1}: qty diminta tidak valid`);
    if (!Number.isFinite(issued) || issued < 0) return badRequest(`Baris ${index + 1}: qty keluar tidak valid`);
    if (issued > requested) return badRequest(`Baris ${index + 1}: qty keluar melebihi qty diminta`);
    if (!item.unit || typeof item.unit !== 'string') return badRequest(`Baris ${index + 1}: satuan wajib diisi`);
  }
  const scope = scopeFilter(s.role as Role, s.brandId, s.outletId);
  if (['outlet_manager', 'supervisor', 'kitchen_lead', 'staff'].includes(s.role) && !scope.outletId) return forbidden('Outlet akun belum ditentukan');
  if (s.role === 'brand_manager' && !scope.brandId) return forbidden('Brand akun belum ditentukan');
  const source = await findRow(TABS.locations, 'location_id', body.source_location_id);
  if (!source || !['active', '1'].includes((source.row.active_status ?? '').toLowerCase())) return badRequest('Lokasi asal tidak aktif');
  if ((scope.brandId && source.row.brand_id !== scope.brandId) || (scope.outletId && source.row.outlet_id !== scope.outletId)) return forbidden('Lokasi asal di luar cakupan akun');
  if ((body.brand_id && body.brand_id !== source.row.brand_id) || (body.outlet_id && body.outlet_id !== source.row.outlet_id)) return badRequest('Brand/outlet tidak sesuai lokasi asal');
  body.brand_id = source.row.brand_id;
  body.outlet_id = source.row.outlet_id;
  if (body.destination_location_id) {
    const destination = await findRow(TABS.locations, 'location_id', body.destination_location_id);
    if (!destination || !['active', '1'].includes((destination.row.active_status ?? '').toLowerCase())) return badRequest('Lokasi tujuan tidak aktif');
    if (destination.row.brand_id !== source.row.brand_id || (scope.outletId && destination.row.outlet_id !== scope.outletId)) return forbidden('Lokasi tujuan di luar cakupan');
  }
  for (const line of body.items) {
    const item = await findRow(TABS.items, 'item_id', line.item_id);
    if (!item || !['active', '1'].includes((item.row.active_status ?? '').toLowerCase())) return badRequest('Item tidak aktif');
    if (item.row.brand_id && item.row.brand_id !== source.row.brand_id) return badRequest('Brand item tidak sesuai lokasi');
    if (!item.row.base_unit || normalizeUnit(line.unit) !== normalizeUnit(item.row.base_unit)) return badRequest('Stock Issue wajib memakai satuan dasar item');
    line.unit = item.row.base_unit;
  }
  // Validate availability for every OUT leg BEFORE writing anything.
  const outByKey = new Map<string, number>();
  for (const item of body.items) {
    const issued = Number(item.issued_qty ?? item.requested_qty ?? 0);
    if (!(issued > 0)) continue;
    const key = `${item.item_id}|${body.source_location_id}`;
    outByKey.set(key, (outByKey.get(key) ?? 0) + issued);
  }
  for (const [key, total] of outByKey) {
    const [itemId, locationId] = key.split('|');
    const available = await bookStock(itemId, locationId);
    if (total > available) return badRequest(`Stok tidak cukup: ${itemId} di ${locationId} tersedia ${available}, diminta ${total}`);
  }

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
    requested_by: body.requested_by ?? s.userId,
    issued_by: s.userId,
    received_by: body.received_by ?? '',
    approval_status: 'POSTING',
    notes: body.notes ?? '',
    created_at: now,
    approved_at: ''
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
      issued_qty: String(it.issued_qty ?? it.requested_qty ?? 0),
      unit: it.unit,
      batch_reference: it.batch_reference ?? '',
      purpose: it.purpose ?? '',
      notes: it.notes ?? ''
    };
    detailRows.push(detail);
  }
  try {
  await appendRows(TABS.stockIssueItem, detailRows);

  // Auto-post ledger. Each line/leg gets its own reference id: one business
  // issue produces many movements, so reusing issueId would be rejected as a
  // duplicate (and previously the failure was swallowed, leaving stock wrong).
  const postedMovements: string[] = [];
  for (const [lineIndex, it] of body.items.entries()) {
    const issuedQty = Number(it.issued_qty ?? it.requested_qty ?? 0);
    if (!(issuedQty > 0)) continue;

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
      referenceId: `${issueId}:${lineIndex + 1}:out`,
      createdBy: s.userId,
      notes: `Issue ${issueId}: ${it.purpose || ''}`
    });
    postedMovements.push(`${issueId}:${lineIndex + 1}:out`);

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
        referenceId: `${issueId}:${lineIndex + 1}:in`,
        createdBy: s.userId,
        notes: `Issue ${issueId} destination: ${it.purpose || ''}`
      });
      postedMovements.push(`${issueId}:${lineIndex + 1}:in`);
    }
  }

  const stored = await findRow(TABS.stockIssue, 'issue_id', issueId);
  if (!stored) throw new Error('Stock issue header unavailable after posting');
  header.approval_status = 'APPROVED';
  header.approved_at = nowTimestampWib();
  await updateRow(TABS.stockIssue, stored.rowNumber, header);
  } catch (error) {
    const stored = await findRow(TABS.stockIssue, 'issue_id', issueId);
    if (stored) await updateRow(TABS.stockIssue, stored.rowNumber, { ...stored.row, approval_status: 'POSTING_FAILED', approved_at: '' });
    throw error;
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
