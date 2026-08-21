/**
 * Alert dedupe helper.
 *
 * Before appending a new alert row to warehouse_alert_log, callers should
 * check whether an OPEN alert with the same (item_id, alert_type, reference_id)
 * already exists. Reusing the existing row avoids duplicate alerts when the
 * same condition (e.g. a receiving discrepancy, a near-expiry batch) is
 * reported more than once for the same item/batch/receipt.
 */
import { readTab, TABS } from '@/db/sheets';

export interface AlertRowRef {
  row: Record<string, string>;
  rowNumber: number;
}

/**
 * Find an OPEN alert matching (item_id, alert_type, reference_id).
 * Returns the existing alert row (and its row number) when found, or null.
 * Any of the three keys may be empty; an empty key matches an empty value.
 */
export async function findOpenAlert(
  itemId: string,
  alertType: string,
  referenceId: string
): Promise<AlertRowRef | null> {
  const rows = await readTab<Record<string, string>>(TABS.alertLog);
  const idx = rows.findIndex(
    (r) =>
      r.status === 'OPEN' &&
      (r.item_id ?? '') === itemId &&
      (r.alert_type ?? '') === alertType &&
      (r.reference_id ?? '') === referenceId
  );
  return idx >= 0 ? { row: rows[idx], rowNumber: idx + 2 } : null;
}