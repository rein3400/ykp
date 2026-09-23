/**
 * Optimistic-concurrency guard for Google Sheets read-modify-write flows.
 *
 * Google Sheets has no transactions or compare-and-swap primitive, so a
 * concurrent double-approve/double-spend against the same row could read the
 * same "before" state, both transition, and both write — one silently
 * overwriting the other. This guard makes that impossible to do silently.
 *
 * The guard re-reads the row by id immediately before writing and compares a
 * version field (`updated_at` by default) to the snapshot captured at the
 * original read. If the field changed, another request won the race and this
 * one returns a clear `ConcurrentUpdateError` (→ 409) instead of a silent
 * overwrite. The caller then retries or surfaces the conflict.
 */
import { updateRow, findRow, type TabName } from '@/db/sheets';

export class ConcurrentUpdateError extends Error {
  constructor(message = 'Row was modified by another request (optimistic-concurrency check failed)') {
    super(message);
    this.name = 'ConcurrentUpdateError';
  }
}

export interface RowSnapshot {
  row: Record<string, string>;
  rowNumber: number;
}

/**
 * Re-read a row by its id and write `newRow` only if the version field is
 * unchanged since `snapshot` was taken. Throws `ConcurrentUpdateError` if
 * another request modified the row in the meantime (or the row vanished).
 *
 * @param tab       TABS key to read/write.
 * @param idColumn  column holding the row id (e.g. 'expense_id').
 * @param id        row id value.
 * @param snapshot  the row snapshot taken at the original read.
 * @param newRow    the row to write on success.
 * @param versionField  field used as the version stamp (default 'updated_at').
 * @returns the updated rowNumber on success.
 */
export async function guardedUpdateRow(
  tab: TabName,
  idColumn: string,
  id: string,
  snapshot: RowSnapshot,
  newRow: Record<string, string>,
  versionField: string = 'updated_at'
): Promise<number> {
  const current = await findRow(tab, idColumn, id);
  if (!current) {
    throw new ConcurrentUpdateError(`Row ${id} not found on re-read (deleted by another request)`);
  }
  const beforeVersion = snapshot.row[versionField] ?? '';
  const currentVersion = current.row[versionField] ?? '';
  if (beforeVersion !== currentVersion) {
    throw new ConcurrentUpdateError(
      `Row ${id} version changed: expected ${versionField}=${beforeVersion}, found ${currentVersion}`
    );
  }
  await updateRow(tab, current.rowNumber, newRow);
  return current.rowNumber;
}