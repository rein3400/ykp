/**
 * Hermez chat actor resolution + access gate.
 *
 * The chat bot is restricted to the owner and department heads. The HR-v1
 * app is the single source of truth for the Telegram chat id → RBAC actor
 * mapping (master_employee.telegram_id → users.role/brand/outlet), so we
 * resolve it over the public /api/hr/telegram-actor endpoint.
 */
import { CONFIG } from './config.js';

export interface Actor {
  userId: string;
  role: string;
  brandId: string;
  outletId: string;
  employeeId: string;
}

/** Roles allowed to chat with Hermez (owner + department heads). */
const ALLOWED_ROLES = new Set([
  'owner',
  'super_admin',
  'hr_admin',
  'finance_admin',
  'brand_manager',
  'outlet_manager',
  'supervisor'
]);

/** Roles that see every brand/outlet (no scope filter). */
const GLOBAL_ROLES = new Set(['owner', 'super_admin', 'hr_admin', 'finance_admin']);

export interface Scope {
  brandId?: string;
  outletId?: string;
}

export function isAllowedRole(role: string): boolean {
  return ALLOWED_ROLES.has(role.toLowerCase());
}

export function scopeFor(actor: Actor): Scope {
  if (GLOBAL_ROLES.has(actor.role.toLowerCase())) return {};
  if (actor.role.toLowerCase() === 'brand_manager') {
    return actor.brandId ? { brandId: actor.brandId } : {};
  }
  // outlet_manager / supervisor → own outlet (falls back to brand when no outlet).
  if (actor.outletId) return { outletId: actor.outletId };
  if (actor.brandId) return { brandId: actor.brandId };
  return {};
}

/** Resolve a Telegram chat id to an actor via the HR-v1 endpoint.
 *  Authenticated with the shared x-bot-secret (the endpoint is not public). */
export async function resolveActor(chatId: number): Promise<Actor | null> {
  const url = `${CONFIG.modules.hr}/api/hr/telegram-actor?telegram_id=${encodeURIComponent(String(chatId))}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: CONFIG.botSecret ? { 'x-bot-secret': CONFIG.botSecret } : {}
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Record<string, string> };
    const d = json.data;
    if (!d) return null;
    return {
      userId: d.user_id ?? '',
      role: (d.role ?? 'employee').toLowerCase(),
      brandId: d.brand_id ?? '',
      outletId: d.outlet_id ?? '',
      employeeId: d.employee_id ?? ''
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
