/**
 * POST /api/finance/import/error-report
 * Generates a downloadable CSV of import errors. The client passes back the
 * errors array returned by the import (dry-run or real) so finance can review
 * and fix the bad rows. RBAC: import action.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { can, type Role } from '@/lib/rbac';
import { toCsv } from '@/lib/csv';

interface ImportError {
  row?: number;
  field?: string;
  reason?: string;
  raw?: string;
}

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'import', 'pos')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as { errors?: ImportError[] };
  const errors = Array.isArray(body.errors) ? body.errors : [];
  if (errors.length === 0) return badRequest('errors array is required');

  const rows = errors.map((e) => ({
    row: e.row ?? '',
    field: e.field ?? '',
    reason: e.reason ?? '',
    raw: e.raw ?? '',
  }));

  const csv = toCsv(['row', 'field', 'reason', 'raw'], rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ykp-import-errors.csv"',
    },
  });
});
