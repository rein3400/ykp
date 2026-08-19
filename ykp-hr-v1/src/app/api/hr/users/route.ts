/**
 * User & Role Management API (revisi item 26).
 * GET list users, POST create, PUT update role/status/scope.
 * Password stored as bcrypt (legacy sha256 rows migrate on login).
 */
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, list, ok, badRequest, unauthorized, forbidden, notFound, conflict } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { hashPassword } from '@/lib/password';
import { z } from 'zod';

const ROLES = [
  'owner', 'super_admin', 'hr_admin', 'finance_admin',
  'brand_manager', 'outlet_manager', 'supervisor', 'employee', 'viewer'
] as const;

const insertSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6),
  role: z.enum(ROLES),
  brand_id: z.string().default(''),
  outlet_id: z.string().default(''),
  employee_id: z.string().default(''),
  active_status: z.enum(['active', 'inactive']).default('active')
});

const updateSchema = z.object({
  user_id: z.string().min(1),
  role: z.enum(ROLES).optional(),
  brand_id: z.string().optional(),
  outlet_id: z.string().optional(),
  employee_id: z.string().optional(),
  active_status: z.enum(['active', 'inactive']).optional(),
  password: z.string().min(6).optional()
});

function stripSecret(row: Record<string, string>): Record<string, string> {
  const { password_hash: _p, ...rest } = row;
  return rest;
}

export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'view', 'user')) return forbidden();

  const rows = await readTab<Record<string, string>>(TABS.users);
  return list(rows.map(stripSecret));
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'create', 'user')) return forbidden();

  const body = await req.json();
  const parsed = insertSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  // Only owner/super_admin can create owner/super_admin
  if (
    (parsed.data.role === 'owner' || parsed.data.role === 'super_admin') &&
    session.role !== 'owner' &&
    session.role !== 'super_admin'
  ) {
    return forbidden('Only owner/super_admin can create elevated roles');
  }

  const existing = await findRow(TABS.users, 'username', parsed.data.username);
  if (existing) return conflict(`Username already exists: ${parsed.data.username}`);

  // Generate user_id
  const all = await readTab<Record<string, string>>(TABS.users);
  let max = 0;
  for (const r of all) {
    const m = (r.user_id || '').match(/^USR-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const userId = `USR-${String(max + 1).padStart(3, '0')}`;
  const now = nowTimestampWib();

  const row: Record<string, string> = {
    user_id: userId,
    username: parsed.data.username,
    password_hash: await hashPassword(parsed.data.password),
    role: parsed.data.role,
    brand_id: parsed.data.brand_id,
    outlet_id: parsed.data.outlet_id,
    employee_id: parsed.data.employee_id || '',
    active_status: parsed.data.active_status,
    must_change_password: 'true',
    created_at: now,
    last_login_at: ''
  };
  await appendRows(TABS.users, [row]);

  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'create',
    entity: 'user',
    entityId: userId,
    afterValue: JSON.stringify(stripSecret(row))
  });

  return ok(stripSecret(row), 201);
});

export const PUT = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'update', 'user')) return forbidden();

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.users, 'user_id', parsed.data.user_id);
  if (!found) return notFound('User not found');

  if (
    parsed.data.role &&
    (parsed.data.role === 'owner' || parsed.data.role === 'super_admin') &&
    session.role !== 'owner' &&
    session.role !== 'super_admin'
  ) {
    return forbidden('Only owner/super_admin can assign elevated roles');
  }

  const updated: Record<string, string> = {
    ...found.row,
    role: parsed.data.role ?? found.row.role,
    brand_id: parsed.data.brand_id ?? found.row.brand_id,
    outlet_id: parsed.data.outlet_id ?? found.row.outlet_id,
    employee_id: parsed.data.employee_id ?? found.row.employee_id ?? '',
    active_status: parsed.data.active_status ?? found.row.active_status
  };
  if (parsed.data.password) {
    updated.password_hash = await hashPassword(parsed.data.password);
    updated.must_change_password = 'true';
  }

  await updateRow(TABS.users, found.rowNumber, updated);

  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'update',
    entity: 'user',
    entityId: parsed.data.user_id,
    beforeValue: JSON.stringify(stripSecret(found.row)),
    afterValue: JSON.stringify(stripSecret(updated))
  });

  return ok(stripSecret(updated));
});
