/**
 * Attachments ΓÇö photo/document proof stored in Google Drive.
 * GET  /api/ops/attachments?entity_type=&entity_id=  (PUBLIC, owner feed)
 * POST /api/ops/attachments  multipart: file, entity_type, entity_id
 *      (session) ΓÇö uploads to Drive, appends ops_attachments row.
 * Mock mode: row is written with a MOCK- file_id (bytes are not stored),
 * so the photo-gate flow stays testable without Drive credentials.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, fail, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { isMockMode } from '@/db/mock-store';
import { isDriveConfigured, uploadToDrive } from '@/lib/drive';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { randomBytes } from 'crypto';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB ΓÇö client compresses to ~300KB anyway

export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const entityType = q.get('entity_type') ?? '';
  const entityId = q.get('entity_id') ?? '';
  let rows = await readTab<Record<string, string>>(TABS.attachments);
  if (entityType) rows = rows.filter((r) => r.entity_type === entityType);
  if (entityId) rows = rows.filter((r) => r.entity_id === entityId);
  rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest('multipart form-data required');
  const file = form.get('file');
  const entityType = String(form.get('entity_type') ?? '');
  const entityId = String(form.get('entity_id') ?? '');
  if (!(file instanceof File)) return badRequest('file is required');
  if (!file.type.startsWith('image/')) return badRequest('Hanya file gambar (foto) yang diizinkan');
  if (file.size <= 0) return badRequest('File kosong');
  if (file.size > MAX_BYTES) return badRequest('File terlalu besar (maks 10MB)');
  if (!entityType) return badRequest('entity_type is required');

  const mock = isMockMode();
  if (!mock && !isDriveConfigured()) {
    return fail('drive_not_configured', 'Google Drive belum dikonfigurasi (YKP_DRIVE_FOLDER_ID)', 503);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileId = mock
    ? `MOCK-${randomBytes(8).toString('hex').toUpperCase()}`
    : await uploadToDrive(`${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`, file.type, buffer);

  const row = {
    attachment_id: nextSequentialIdSync('ATT'),
    entity_type: entityType,
    entity_id: entityId,
    file_id: fileId,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: String(buffer.length),
    uploaded_by: s.userId,
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.attachments, [row]);
  await logAudit({
    module: 'ops',
    action: 'create',
    recordType: 'attachment',
    recordId: row.attachment_id,
    afterValue: JSON.stringify(row),
    userId: s.userId
  }).catch(() => null);

  return ok({ ...row, url: `/api/ops/attachments/${row.attachment_id}/file` }, 201);
});
