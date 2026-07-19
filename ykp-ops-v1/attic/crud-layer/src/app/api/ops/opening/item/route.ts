/**
 * Opening checklist item update. After each item change the parent header
 * (completion %, critical failed count, outlet ready status) is recomputed
 * using the pure checklist lib.
 */
import { NextRequest } from 'next/server';
import { readTab, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, forbidden, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { can } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { completionPct, criticalFailedCount, issueCount, outletReadyStatus } from '@/lib/checklist';

const VALID_STATUS = new Set(['NOT_STARTED', 'OK', 'ISSUE', 'FAILED', 'WAIVED', 'REVIEWED']);

export const PATCH = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as never, 'update', 'opening')) return forbidden();

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.item_id) return badRequest('item_id wajib diisi');
  if (body.status !== undefined && !VALID_STATUS.has(body.status)) return badRequest('status tidak valid');

  const found = await findRow(TABS.openingChecklistItem, 'item_id', body.item_id);
  if (!found) return notFound('Item tidak ditemukan');
  const before = { ...found.row };
  const updated = { ...found.row };

  // Business rule: photo wajib untuk item required_photo sebelum OK/REVIEWED
  if (body.status && ['OK', 'REVIEWED'].includes(body.status) && updated.required_photo === 'YES' && !updated.photo_url && !body.photo_url) {
    return badRequest('Foto wajib untuk item ini sebelum ditandai OK (INCOMPLETE tanpa foto)');
  }

  for (const k of ['status', 'actual_value', 'notes', 'photo_url']) {
    if (body[k] !== undefined) updated[k] = body[k];
  }
  if (body.status && body.status !== 'NOT_STARTED') {
    updated.submitted_by = s.userId;
    updated.submitted_at = nowTimestampWib();
  }
  updated.updated_at = nowTimestampWib();
  await updateRow(TABS.openingChecklistItem, found.rowNumber, updated);

  // Recompute parent header
  const header = await findRow(TABS.openingChecklist, 'checklist_id', updated.checklist_id);
  if (header) {
    const items = (await readTab<Record<string, string>>(TABS.openingChecklistItem))
      .filter((i) => i.checklist_id === updated.checklist_id);
    await updateRow(TABS.openingChecklist, header.rowNumber, {
      ...header.row,
      status: outletReadyStatus(items),
      completion_pct: String(completionPct(items)),
      critical_failed_count: String(criticalFailedCount(items)),
      issue_count: String(issueCount(items)),
      updated_at: nowTimestampWib()
    });
  }

  await logAudit({
    module: 'ops', action: 'update', recordType: 'ops_opening_checklist_item', recordId: body.item_id,
    beforeValue: JSON.stringify(before), afterValue: JSON.stringify(updated), userId: s.userId
  }).catch(() => null);
  return ok(updated);
});
