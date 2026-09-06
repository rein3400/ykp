/** TEST-ONLY stub for `@/lib/audit`. Records calls, never touches a DB. */
export const __auditCalls = [];
export async function logAudit(entry) {
  __auditCalls.push({ ...entry });
}
