/**
 * RBAC for Warehouse & Inventory Control V1.
 * 11 roles per brief §27. Resources cover all 18 modules.
 */
export type Role =
  | 'owner' | 'super_admin' | 'warehouse_admin' | 'purchasing'
  | 'finance_admin' | 'brand_manager' | 'outlet_manager' | 'supervisor'
  | 'kitchen_lead' | 'staff' | 'viewer';

export type Resource =
  | 'item' | 'location' | 'supplier' | 'unit_conversion' | 'category' | 'threshold'
  | 'receiving' | 'stock_issue' | 'transfer' | 'waste' | 'adjustment'
  | 'stock_count' | 'stock_ledger' | 'batch_stock'
  | 'purchase_recommendation' | 'purchase_request'
  | 'alert' | 'action' | 'summary' | 'telegram'
  | 'dashboard' | 'audit' | 'user' | 'master';

export type Action = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'generate';

export function can(role: Role, action: Action, resource: Resource): boolean {
  if (role === 'owner') return true;
  const m = MATRIX[role];
  if (!m) return false;
  const a = m[resource];
  if (!a) return false;
  return a.includes(action);
}

export function scopeFilter(
  role: Role,
  userBrandId?: string,
  userOutletId?: string
): { brandId?: string; outletId?: string } {
  if (role === 'owner' || role === 'super_admin') return {};
  if (role === 'warehouse_admin' || role === 'purchasing' || role === 'finance_admin') return {};
  if (role === 'brand_manager') return { brandId: userBrandId };
  if (role === 'outlet_manager' || role === 'supervisor' || role === 'kitchen_lead' || role === 'staff') {
    return { brandId: userBrandId, outletId: userOutletId };
  }
  return {};
}

const V = ['view'] as Action[];
const VE = ['view', 'export'] as Action[];
const VC = ['view', 'create'] as Action[];
const VCE = ['view', 'create', 'export'] as Action[];
const WRITE: Action[] = ['view', 'create', 'update', 'export'];
const FULL: Action[] = ['view', 'create', 'update', 'delete', 'approve', 'export', 'generate'];
const NO_DELETE: Action[] = ['view', 'create', 'update', 'approve', 'export', 'generate'];

const MATRIX: Partial<Record<Role, Partial<Record<Resource, Action[]>>>> = {
  owner: {
    item: FULL, location: FULL, supplier: FULL, unit_conversion: FULL, category: FULL, threshold: FULL,
    receiving: FULL, stock_issue: FULL, transfer: FULL, waste: FULL, adjustment: FULL,
    stock_count: FULL, stock_ledger: FULL, batch_stock: FULL,
    purchase_recommendation: FULL, purchase_request: FULL,
    alert: FULL, action: FULL, summary: FULL, telegram: FULL,
    dashboard: FULL, audit: FULL, user: FULL, master: FULL
  },
  super_admin: {
    item: FULL, location: FULL, supplier: FULL, unit_conversion: FULL, category: FULL, threshold: FULL,
    receiving: FULL, stock_issue: FULL, transfer: FULL, waste: FULL, adjustment: FULL,
    stock_count: FULL, stock_ledger: FULL, batch_stock: FULL,
    purchase_recommendation: FULL, purchase_request: FULL,
    alert: FULL, action: FULL, summary: FULL, telegram: FULL,
    dashboard: FULL, audit: FULL, user: FULL, master: FULL
  },
  warehouse_admin: {
    item: FULL, location: FULL, supplier: FULL, unit_conversion: FULL, category: FULL, threshold: FULL,
    receiving: FULL, stock_issue: FULL, transfer: FULL, waste: FULL, adjustment: ['view', 'create', 'update', 'export'],
    stock_count: FULL, stock_ledger: VE, batch_stock: FULL,
    purchase_recommendation: VE, purchase_request: VE,
    alert: VE, action: VE, summary: FULL, telegram: VE,
    dashboard: FULL, audit: VE, master: WRITE
  },
  purchasing: {
    item: VE, location: V, supplier: WRITE, unit_conversion: V, category: V, threshold: V,
    receiving: VE, stock_issue: V, transfer: V, waste: V,
    purchase_recommendation: FULL, purchase_request: FULL,
    alert: VE, action: VE, summary: VE, telegram: VE,
    dashboard: VE, audit: V
  },
  finance_admin: {
    item: VE, location: V, supplier: WRITE, unit_conversion: V, category: V, threshold: V,
    receiving: VE, stock_issue: V, transfer: V, waste: VE,
    purchase_recommendation: VE, purchase_request: VE,
    alert: VE, action: VE, summary: VE, telegram: VE,
    dashboard: VE, audit: V
  },
  brand_manager: {
    item: VE, location: VE, supplier: VE, unit_conversion: VE, category: VE, threshold: VE,
    receiving: NO_DELETE, stock_issue: NO_DELETE, transfer: NO_DELETE, waste: NO_DELETE,
    adjustment: VE, stock_count: NO_DELETE, stock_ledger: VE, batch_stock: VE,
    purchase_recommendation: VE, purchase_request: VE,
    alert: NO_DELETE, action: NO_DELETE, summary: VE, telegram: VE,
    dashboard: VE, audit: V
  },
  outlet_manager: {
    item: VE, location: VE, supplier: VE, unit_conversion: V, category: V, threshold: V,
    receiving: WRITE, stock_issue: WRITE, transfer: WRITE, waste: WRITE,
    adjustment: VE, stock_count: WRITE, stock_ledger: VE, batch_stock: VE,
    purchase_recommendation: VE, purchase_request: VE,
    alert: WRITE, action: WRITE, summary: VE, telegram: VE,
    dashboard: VE, audit: V
  },
  supervisor: {
    item: VE, location: VE, supplier: VE, unit_conversion: V, category: V, threshold: V,
    receiving: WRITE, stock_issue: WRITE, transfer: WRITE, waste: WRITE,
    adjustment: VE, stock_count: WRITE, stock_ledger: VE, batch_stock: VE,
    purchase_recommendation: VE, purchase_request: VE,
    alert: WRITE, action: WRITE, summary: VE, telegram: VE,
    dashboard: VE, audit: V
  },
  kitchen_lead: {
    item: V, location: V, supplier: V, unit_conversion: V, category: V, threshold: V,
    receiving: VC, stock_issue: VC, transfer: V, waste: VC,
    stock_count: V, stock_ledger: V, batch_stock: V,
    purchase_recommendation: V, purchase_request: V,
    alert: V, action: V, summary: V, telegram: V,
    dashboard: V, audit: V
  },
  staff: {
    item: V, location: V, supplier: V, unit_conversion: V, category: V, threshold: V,
    receiving: V, stock_issue: VC, transfer: V, waste: VC,
    stock_count: V, stock_ledger: V, batch_stock: V,
    purchase_recommendation: V, purchase_request: V,
    alert: V, action: V, summary: V, telegram: V,
    dashboard: V, audit: V
  },
  viewer: {
    item: V, location: V, supplier: V, unit_conversion: V, category: V, threshold: V,
    receiving: V, stock_issue: V, transfer: V, waste: V,
    stock_count: V, stock_ledger: V, batch_stock: V,
    purchase_recommendation: V, purchase_request: V,
    alert: V, action: V, summary: V, telegram: V,
    dashboard: V, audit: V
  }
};
