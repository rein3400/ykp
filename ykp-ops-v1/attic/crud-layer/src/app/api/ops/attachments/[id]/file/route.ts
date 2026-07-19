/**
 * PUBLIC: stream an attachment's bytes from Drive.
 * GET /api/ops/attachments/[id]/file
 * Auth bypassed for GET in middleware.ts ΓÇö ids are unguessable (ATT-XXXXXX
 * + Drive file ids), files are proof photos meant for the owner feed.
 * Photos are immutable ΓåÆ aggressive cache headers.
 */
import { NextRequest, NextResponse } from 'next/server';
import { findRow, TABS } from '@/db/sheets';
import { notFound } from '@/lib/http';
import { isDriveConfigured, getFileFromDrive } from '@/lib/drive';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
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
}
