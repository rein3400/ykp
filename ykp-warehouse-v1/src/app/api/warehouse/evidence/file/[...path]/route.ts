/**
 * GET /api/warehouse/evidence/file/<transaction>/<txnId>/<fileName>
 * Streams a locally-persisted evidence file written by the upload route
 * (active when Supabase storage is not configured). Session-gated.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/session';

const MIME_BY_EXT: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm'
};

function evidenceDir(): string {
  return path.join(process.cwd(), '.data', 'evidence');
}

// Next 16 catch-all params are typed { path: string[] } and wrapped in a
// Promise; the shared handler() helper types params as a flat record, so this
// route wires auth + errors explicitly instead.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  try {
    const s = await getSession();
    if (!s) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Unauthorized' } },
        { status: 401 }
      );
    }
    const { path: catchAll } = await context.params;
    const segments = catchAll ?? [];
    if (segments.length === 0 || segments.some((seg) => !seg || seg.includes('..'))) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Evidence not found' } },
        { status: 404 }
      );
    }
    const fileName = segments[segments.length - 1] ?? '';
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const contentType = MIME_BY_EXT[ext];
    if (!contentType) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Unknown evidence type' } },
        { status: 404 }
      );
    }
    const baseDir = evidenceDir();
    const filePath = path.join(baseDir, ...segments);
    if (!filePath.startsWith(baseDir) || !fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Evidence not found' } },
        { status: 404 }
      );
    }
    const buf = fs.readFileSync(filePath);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400'
      }
    });
  } catch (e) {
    console.error('[evidence-file]', e);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}