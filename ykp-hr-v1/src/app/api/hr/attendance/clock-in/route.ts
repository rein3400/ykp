/**
 * Quick clock-in: today WIB, no body required except employee_id.
 * Resolves today's roster + shift to detect lateness per brief §6.3.
 * Returns the existing row with already:true if already clocked in today.
 */
import { getSession } from '@/lib/session';
import { handler, badRequest, unauthorized, forbidden, missingRef, ok } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { performClockIn } from '@/lib/attendance-service';
import { z } from 'zod';

const schema = z.object({
  employee_id: z.string().min(1),
  latitude: z.union([z.number(), z.string()]).optional(),
  longitude: z.union([z.number(), z.string()]).optional(),
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'create', 'attendance')) return unauthorized();

  // Safe parse — req.json() on empty/invalid body throws and surfaces as a
  // 500 (VERIFICATION_REPORT P2: multi-click 5xx). Treat as bad request.
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const result = await performClockIn({
    employeeId: parsed.data.employee_id,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    actor: { userId: session.userId, role: session.role, employeeId: session.employeeId },
    source: 'web'
  });

  if (!result.ok) {
    const e = result.error;
    if (e.status === 403) return forbidden(e.message);
    if (e.status === 400) return missingRef(e.message);
    return badRequest(e.message);
  }
  return ok(result.already ? { ...result.row, already: true } : result.row, result.already ? 200 : 201);
});
