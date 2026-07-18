/**
 * RBAC for Operational V1.
 * Roles: owner, ops_admin, brand_manager, outlet_manager, supervisor, staff, viewer
 */
export type Role =
  | 'owner'
  | 'ops_admin'
  | 'brand_manager'
  | 'outlet_manager'
  | 'supervisor'
  | 'staff'
  | 'viewer';

export type Resource =
  | 'briefing'
  | 'opening'
  | 'kds'
  | 'qc'
  | 'incident'
  | 'closing'
  | 'waste'
  | 'stock_issue'
  | 'summary'
  | 'analytics'
  | 'threshold'
  | 'master'
  | 'user'
  | 'audit';

export type Action = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'generate';

const ALL: Action[] = ['view', 'create', 'update', 'delete', 'approve', 'export', 'generate'];
const VE: Action[] = ['view', 'export'];
const WRITE: Action[] = ['view', 'create', 'update', 'export'];
const NO_DELETE: Action[] = ['view', 'create', 'update', 'approve', 'export', 'generate'];

const MATRIX: Partial<Record<Role, Partial<Record<Resource, Action[]>>>> = {
  owner: {
    briefing: ALL, opening: ALL, kds: ALL, qc: ALL, incident: ALL, closing: ALL,
    waste: ALL, stock_issue: ALL, summary: ALL, analytics: ALL, threshold: ALL,
    master: ALL, user: ALL, audit: VE,
  },
  ops_admin: {
    briefing: ALL, opening: ALL, kds: ALL, qc: ALL, incident: ALL, closing: ALL,
    waste: ALL, stock_issue: ALL, summary: ALL, analytics: ALL, threshold: ALL,
    master: ALL, user: ALL, audit: VE,
  },
  brand_manager: {
    briefing: NO_DELETE, opening: NO_DELETE, kds: WRITE, qc: NO_DELETE, incident: NO_DELETE,
    closing: NO_DELETE, waste: NO_DELETE, stock_issue: WRITE, summary: VE, analytics: VE,
    threshold: VE, master: VE, user: VE, audit: VE,
  },
  outlet_manager: {
    briefing: NO_DELETE, opening: NO_DELETE, kds: WRITE, qc: NO_DELETE, incident: NO_DELETE,
    closing: NO_DELETE, waste: NO_DELETE, stock_issue: WRITE, summary: VE, analytics: VE,
    threshold: VE, master: VE, user: VE, audit: VE,
  },
  supervisor: {
    briefing: WRITE, opening: WRITE, kds: WRITE, qc: WRITE, incident: WRITE,
    closing: WRITE, waste: WRITE, stock_issue: WRITE, summary: VE, analytics: VE,
    threshold: VE, master: VE, user: [], audit: [],
  },
  staff: {
    briefing: ['view'], opening: WRITE, kds: WRITE, qc: WRITE, incident: WRITE,
    closing: WRITE, waste: WRITE, stock_issue: WRITE, summary: ['view'], analytics: [],
    threshold: [], master: [], user: [], audit: [],
  },
  viewer: {
    briefing: VE, opening: VE, kds: VE, qc: VE, incident: VE, closing: VE,
    waste: VE, stock_issue: VE, summary: VE, analytics: VE, threshold: VE,
    master: VE, user: [], audit: [],
  },
};

export function can(role: Role | string, action: Action, resource: Resource): boolean {
  if (role === 'owner') return true;
  const m = MATRIX[role as Role];
  if (!m) return false;
  const a = m[resource];
  if (!a) return false;
  return a.includes(action);
}
