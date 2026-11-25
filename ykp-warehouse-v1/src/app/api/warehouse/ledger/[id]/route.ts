import { NextRequest } from 'next/server';
import { readTab, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { badRequest, forbidden, handler, notFound, ok, unauthorized } from '@/lib/http';
import { logAudit } from '@/lib/audit';

/** Fields that must never change: they define the stock chain and its meaning. */
const IMMUTABLE = ['quantity', 'base_unit', 'movement_type', 'direction', 'location_id', 'item_id'] as const;

/**
 * Correct a ledger row. Only bookkeeping values that do not move stock may be
 * fixed: unit cost (and the derived total) plus notes. Quantity errors must go
 * through Stock Adjustment so the ledger keeps a reversal trail.
 */
export const PUT = handler(async (req: NextRequest, ctx: { params: Record<string, string> }) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'update', 'stock_ledger')) return forbidden();

  const { id } = ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest('Body tidak valid');
  if (IMMUTABLE.some((field) => body[field] !== undefined)) {
    return badRequest('Qty, tipe, arah, item dan lokasi tidak boleh diubah; gunakan Stock Adjustment');
  }
  const reason = String(body.reason ?? '').trim();
  if (reason.length < 5) return badRequest('Alasan koreksi wajib diisi (minimal 5 karakter)');

  const rows = await readTab<Record<string, string>>(TABS.stockMovement);
  const existing = rows.find((row) => row.movement_id === id);
  if (!existing) return notFound('Baris ledger tidak ditemukan');
  const found = await findRow(TABS.stockMovement, 'movement_id', id);
  if (!found) return notFound('Baris ledger tidak ditemukan');

  const next: Record<string, string> = { ...existing };
  const cost = body.unit_cost === undefined ? Number(existing.unit_cost || 0) : Number(body.unit_cost);
  if (!Number.isFinite(cost) || cost < 0) return badRequest('Unit cost harus angka >= 0');
  if (body.unit_cost !== undefined) {
    next.unit_cost = String(body.unit_cost);
    next.total_value = String(Math.round(Number(existing.quantity || 0) * cost * 100) / 100);
  }
  if (body.notes !== undefined) next.notes = String(body.notes);
  if (body.unit_cost === undefined && body.notes === undefined) return badRequest('Tidak ada perubahan');

  await updateRow(TABS.stockMovement, found.rowNumber, next);
  await logAudit({
    module: 'warehouse',
    action: 'update',
    recordType: 'stock_ledger',
    recordId: id,
    beforeValue: JSON.stringify(existing),
    afterValue: JSON.stringify(next),
    userId: session.userId,
  });
  return ok({ ...next, correction_reason: reason });
});
