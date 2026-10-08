export interface PurgePlan<T> {
  deletableItems: T[];
  blockedItems: { id: string; domains: string[] }[];
  deletableSuppliers: T[];
  blockedSuppliers: { id: string; domains: string[] }[];
}

/**
 * Pure planner for clearing dummy master records. A master is deletable only
 * when NO operational record references it; anything referenced is blocked and
 * reported with the referencing domains. Never guesses by name/ID.
 */
export function planMasterPurge(
  items: Record<string, string>[],
  suppliers: Record<string, string>[],
  referencesById: Record<string, string[]> = {}
): PurgePlan<Record<string, string>> {
  const pick = (rows: Record<string, string>[], key: string, refs: Record<string, string[]>) => {
    const deletable: Record<string, string>[] = [];
    const blocked: { id: string; domains: string[] }[] = [];
    for (const row of rows) {
      const id = row[key] ?? '';
      const domains = [...new Set((refs[id] ?? []).filter(Boolean))].sort();
      if (domains.length) blocked.push({ id, domains });
      else deletable.push(row);
    }
    return { deletable, blocked };
  };
  const itemResult = pick(items, 'item_id', referencesById);
  const supplierResult = pick(suppliers, 'supplier_id', referencesById);
  return {
    deletableItems: itemResult.deletable,
    blockedItems: itemResult.blocked,
    deletableSuppliers: supplierResult.deletable,
    blockedSuppliers: supplierResult.blocked
  };
}
