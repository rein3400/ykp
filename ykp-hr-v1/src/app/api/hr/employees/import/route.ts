/**
 * Import employees from CSV. Expected header matching employee columns.
 * Required: full_name, outlet_id, basic_salary. Optional: role, brand_id, salary_type, employment_status, join_date.
 * Owner/HR admin only. Writes audit log.
 */
import { appendRows, readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, ok } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { assertBrand, assertOutlet } from '@/lib/repo';

const MAX_ROWS = 5000;
const MAX_BYTES = 5_000_000; // 5 MB

function csvToRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^﻿/, ''));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        values.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    values.push(cur.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (values[i] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"')));
    return row;
  });
}

function pad(n: number, len = 3) {
  return String(n).padStart(len, '0');
}

async function nextEmployeeId(): Promise<string> {
  const rows = await readTab<Record<string, string>>(TABS.employees);
  let max = 0;
  for (const r of rows) {
    const id = r.employee_id;
    if (id.startsWith('EMP-')) {
      const n = Number(id.split('-')[1]);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `EMP-${pad(max + 1)}`;
}

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'create', 'employee')) return forbidden();

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BYTES) return badRequest(`File too large (max ${MAX_BYTES} bytes)`);

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return badRequest('File required');
  if (file.size > MAX_BYTES) return badRequest(`File too large (max ${MAX_BYTES} bytes)`);
  const text = await file.text();
  const parsed = csvToRows(text);
  if (parsed.length === 0) return badRequest('CSV kosong atau format salah');
  if (parsed.length > MAX_ROWS) return badRequest(`Too many rows (max ${MAX_ROWS})`);

  const now = nowTimestampWib();
  let nextId = await nextEmployeeId();
  const toInsert: Record<string, string>[] = [];

  for (const p of parsed) {
    if (!p.full_name || !p.outlet_id || !p.basic_salary) {
      return badRequest('Setiap baris wajib: full_name, outlet_id, basic_salary');
    }
    try {
      await assertOutlet(p.outlet_id);
      if (p.brand_id) await assertBrand(p.brand_id);
    } catch (e) {
      return badRequest(e instanceof Error ? e.message : 'Invalid brand/outlet');
    }
    toInsert.push({
      employee_id: nextId,
      employee_code: nextId.replace('EMP-', 'K-'),
      full_name: p.full_name,
      nickname: p.nickname ?? '',
      gender: p.gender ?? 'M',
      phone: p.phone ?? '',
      email: p.email ?? '',
      telegram_id: '',
      address: '',
      date_of_birth: '',
      join_date: p.join_date || new Date().toISOString().slice(0, 10),
      employment_status: p.employment_status || 'PROBATION',
      contract_type: '',
      department: '',
      role: p.role || 'staff',
      position: p.position || '',
      brand_id: p.brand_id || 'BR-001',
      outlet_id: p.outlet_id,
      supervisor_id: '',
      basic_salary: String(Number(p.basic_salary)),
      salary_type: p.salary_type || 'MONTHLY',
      bank_name: '',
      bank_account: '',
      account_holder: '',
      bpjs_status: '',
      tax_status: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      photo_url: '',
      active_status: 'active',
      created_at: now,
      updated_at: now,
      created_by: session.userId,
      updated_by: session.userId
    });
    nextId = `EMP-${pad(Number(nextId.split('-')[1]) + 1)}`;
  }

  await appendRows(TABS.employees, toInsert);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'create',
    entity: 'employee_bulk',
    entityId: 'csv-import',
    afterValue: `${toInsert.length} rows`
  });

  return ok({ imported: toInsert.length });
});
