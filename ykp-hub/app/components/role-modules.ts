/**
 * Role-based module visibility for the Hub.
 *
 * Default is "ALL" for every role (the current behaviour) so this wiring
 * never locks anyone out. Fill ROLE_MODULES with a role → module-id
 * allowlist to restrict a specific role later; the mechanism is ready and
 * tested. Keys are upper-cased role names.
 */
export type RoleModuleMap = Record<string, readonly string[] | "ALL">;

export const ROLE_MODULES: RoleModuleMap = {};

export function visibleApps<T extends { id: string }>(
  apps: readonly T[],
  role: string,
  map: RoleModuleMap = ROLE_MODULES
): T[] {
  const key = role ?? "";
  const allow = map[key] ?? map[key.toUpperCase()] ?? "ALL";
  if (allow === "ALL") return [...apps];
  return apps.filter((a) => allow.includes(a.id));
}
