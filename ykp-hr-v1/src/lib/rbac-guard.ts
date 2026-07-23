/**
 * RBAC scope guards for HR V1.
 *
 * The RBAC matrix in rbac.ts says EMPLOYEE has attendance:create, but the
 * business rule is "self check-in/out only" — an employee must not record
 * attendance for another employee. This helper enforces that, plus the
 * outlet-scope rule for outlet_manager/supervisor.
 */

import type { SessionUser } from './session';

/**
 * Resolve the employee_id the caller is allowed to act on for attendance.
 * - employee: only their own linked employee_id (session.employeeId).
 * - outlet_manager/supervisor: any employee in their outlet (caller must
 *   still validate the target employee's outlet == session.outletId).
 * - owner/super_admin/hr_admin/finance_admin/brand_manager/viewer: any.
 *
 * Returns { allowedEmployeeId, selfOnly, forbidden } where forbidden=true
 * means the caller's role+session cannot target the requested employee_id.
 */
export function attendanceTargetGuard(
  session: SessionUser,
  requestedEmployeeId: string
): { selfOnly: boolean; forbidden: boolean; reason?: string } {
  const role = session.role;
  if (role === 'owner' || role === 'super_admin' || role === 'hr_admin' || role === 'finance_admin') {
    return { selfOnly: false, forbidden: false };
  }
  if (role === 'brand_manager' || role === 'viewer') {
    // read-only roles shouldn't create attendance anyway, but if they do,
    // allow any (matrix gates create). No self enforcement.
    return { selfOnly: false, forbidden: false };
  }
  if (role === 'outlet_manager' || role === 'supervisor') {
    // Scope enforced by caller via outlet match (we cannot resolve the target
    // employee's outlet here without a Sheets read; the route already does
    // assertEmployee + reads emp.outlet_id — that path validates outlet scope).
    return { selfOnly: false, forbidden: false };
  }
  if (role === 'employee') {
    if (!session.employeeId) {
      return { selfOnly: true, forbidden: true, reason: 'Akun karyawan belum tertaut ke data karyawan. Hubungi HR admin.' };
    }
    if (requestedEmployeeId !== session.employeeId) {
      return { selfOnly: true, forbidden: true, reason: 'Karyawan hanya dapat mencatat absensi untuk diri sendiri.' };
    }
    return { selfOnly: true, forbidden: false };
  }
  return { selfOnly: true, forbidden: true, reason: 'Role tidak dikenali.' };
}