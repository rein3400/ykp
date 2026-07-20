/**
 * GET /api/warehouse/attachments/[id]/file
 * Session required — stream an attachment's bytes from Drive.
 * Photos are immutable → aggressive cache headers.
 */
import { NextRequest, NextResponse } from 'next/server';
import { findRow, TABS } from '@/db/sheets';
import { notFound, unauthorized, handler } from '@/lib/http';
import { getSession } from '@/lib/session';
import { isDriveConfigured, getFileFromDrive } from '@/lib/drive';

export const GET = handler(async (
  _req: NextRequest,
  { params }: { params: Record<string, string> }
): Promise<NextResponse> => {
  const s = await getSession();
  if (!s) return unauthorized();

  const { id } = params;
  const found = await findRow(TABS.attachments, 'attachment_id', id);
  if (!found) return notFound('Attachment not found');
  const { file_id: fileId, mime_type: mimeType, file_name: fileName } = found.row;
  if (fileId.startsWith('MOCK-')) return notFound('Foto tidak tersimpan (mode mock)');
  if (!isDriveConfigured()) return notFound('Drive tidak dikonfigurasi');

  try {
    const { data, mimeType: driveMime } = await getFileFromDrive(fileId);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': mimeType || driveMime,
        'Content-Length': String(data.length),
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName || id)}"`,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch {
    return notFound('File tidak ditemukan di Drive');
  }
});
