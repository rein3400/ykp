/**
 * Receipts (struk/bon) ΓÇö ops team uploads purchase receipts with a
 * mandatory photo as proof. Photo is uploaded first (attachments API),
 * then linked here. GET list requires session.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, todayWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  const q = req.nextUrl.searchParams;
  const date = q.get('date') ?? '';
  const outletId = q.get('outlet_id') ?? '';
  let rows = await readTab<Record<string, string>>(TABS.receipts);
  if (date) rows = rows.filter((r) => r.date === date);
  if (outletId) rows = rows.filter((r) => r.outlet_id === outletId);
  rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as {
    date?: string; outlet_id?: string; amount?: number;
    description?: string; photo_attachment_id?: string;
  };

  const amount = Math.round(Number(body.amount ?? NaN));
  if (!Number.isFinite(amount) || amount < 0) return badRequest('amount harus angka ΓëÑ 0');
  const description = (body.description ?? '').trim();
  if (!description) return badRequest('description wajib diisi');
  const outletId = (body.outlet_id ?? '').trim();
  if (!outletId) return badRequest('outlet_id wajib diisi');
  const outlet = await findRow(TABS.outlets, 'outlet_id', outletId);
  if (!outlet) return badRequest(`outlet_id tidak ditemukan: ${outletId}`);

  // Hard gate: receipt photo is the whole point of this feature.
  if (!body.photo_attachment_id) return badRequest('Foto struk wajib diunggah sebelum submit');
  const photo = await findRow(TABS.attachments, 'attachment_id', body.photo_attachment_id);
  if (!photo) return badRequest(`Foto tidak ditemukan: ${body.photo_attachment_id}`);

  const id = nextSequentialIdSync('RCP');
  const row = {
    receipt_id: id,
    date: body.date || todayWib(),
    outlet_id: outletId,
    outlet_name: outlet.row.outlet_name ?? '',
    amount: String(amount),
    description,
    photo_url: `/api/ops/attachments/${body.photo_attachment_id}/file`,
    submitted_by: s.userId,
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.receipts, [row]);
  await updateRow(TABS.attachments, photo.rowNumber, {
    ...photo.row,
    entity_type: 'receipt',
    entity_id: id
  }).catch(() => null);
  await logAudit({
    module: 'ops',
    action: 'create',
    recordType: 'receipt',
    recordId: id,
    afterValue: JSON.stringify(row),
    userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
