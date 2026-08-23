import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { assertBrand, assertOutlet } from '@/lib/repo';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, list, badRequest, missingRef, conflict, unauthorized, forbidden, ok } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { formatDateWib, nowTimestampWib, parseIdr } from '@/lib/format';
import { z } from 'zod';

// Revisi item 17 — full employee detail fields
const insertSchema = z.object({
  full_name: z.string().min(1),
  nickname: z.string().default(''),
  gender: z.string().default('M'),
  phone: z.string().default(''),
  email: z.string().email().optional().or(z.literal('')),
  telegram_id: z.string().default(''),
  address: z.string().default(''),
  date_of_birth: z.string().default(''),
  role: z.string().default('staff'),
  position: z.string().default(''),
  department: z.string().default(''),
  brand_id: z.string().min(1),
  outlet_id: z.string().min(1),
  supervisor_id: z.string().default(''),
  basic_salary: z.coerce.number().min(0).int().default(0),
  salary_type: z.string().default('MONTHLY'),
  employment_status: z.string().default('PROBATION'),
  contract_type: z.string().default(''),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bank_name: z.string().default(''),
  bank_account: z.string().default(''),
  account_holder: z.string().default(''),
  bpjs_status: z.string().default(''),
  tax_status: z.string().default(''),
  emergency_contact_name: z.string().default(''),
  emergency_contact_phone: z.string().default('')
});

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

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.employees);
  return list(rows);
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'create', 'employee')) return forbidden();

  const body = await req.json();
  const parsed = insertSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    await assertBrand(parsed.data.brand_id);
    await assertOutlet(parsed.data.outlet_id);
  } catch (e) {
    return missingRef(e instanceof Error ? e.message : 'Missing ref');
  }

  const employeeId = await nextEmployeeId();
  const employeeCode = employeeId.replace('EMP-', 'K-');
  const now = nowTimestampWib();

  const row: Record<string, string> = {
    employee_id: employeeId,
    employee_code: employeeCode,
    full_name: parsed.data.full_name,
    nickname: parsed.data.nickname,
    gender: parsed.data.gender,
    phone: parsed.data.phone,
    email: parsed.data.email ?? '',
    // telegram_id is owned by the /link pairing flow (users.telegram_id) —
    // manual writes here are deprecated (plan §Fase 1 step 4).
    telegram_id: '',
    address: parsed.data.address || '',
    date_of_birth: parsed.data.date_of_birth || '',
    join_date: parsed.data.join_date,
    employment_status: parsed.data.employment_status,
    contract_type: parsed.data.contract_type || '',
    department: parsed.data.department || '',
    role: parsed.data.role,
    position: parsed.data.position,
    brand_id: parsed.data.brand_id,
    outlet_id: parsed.data.outlet_id,
    supervisor_id: parsed.data.supervisor_id || '',
    basic_salary: String(parsed.data.basic_salary),
    salary_type: parsed.data.salary_type,
    bank_name: parsed.data.bank_name,
    bank_account: parsed.data.bank_account,
    account_holder: parsed.data.account_holder,
    bpjs_status: parsed.data.bpjs_status || '',
    tax_status: parsed.data.tax_status || '',
    emergency_contact_name: parsed.data.emergency_contact_name || '',
    emergency_contact_phone: parsed.data.emergency_contact_phone || '',
    photo_url: '',
    active_status: 'active',
    created_at: now,
    updated_at: now,
    created_by: session.userId,
    updated_by: session.userId
  };

  const existing = await findRow(TABS.employees, 'employee_id', employeeId);
  if (existing) return conflict('Duplicate employee_id generated, retry');

  await appendRows(TABS.employees, [row]);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'create',
    entity: 'employee',
    entityId: employeeId,
    afterValue: JSON.stringify(parsed.data)
  });

  return ok(row, 201);
});
