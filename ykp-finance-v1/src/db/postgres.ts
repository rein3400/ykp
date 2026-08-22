/**
 * Drop-in PostgreSQL backend for the Sheets db layer.
 *
 * Mirrors the exact function contract of `sheets.ts`:
 *   readTab / appendRows / updateRow / findRow
 * Row identity uses the `__rownum` BIGSERIAL column (1-based sequence per
 * table) so callers that pass Sheets-style `rowNumber` keep working.
 *
 * All columns TEXT (matching the Sheets mirror DDL). Values are passed as
 * parameterized text. Empty/undefined fields are stored as '' to match the
 * Sheets behaviour where readTab maps empty cells to ''.
 *
 * Enable per app: set USE_POSTGRES=true and DATABASE_URL=postgres://...
 *
 * Pure db client — no business logic here.
 */
import { Pool, type QueryResult } from 'pg';

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (USE_POSTGRES=true requires it)');
  pool = new Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX ?? '10'),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });
  return pool;
}

/** Whether the Postgres backend is active. Checked per call so tests can flip env. */
export function isPostgresMode(): boolean {
  return (process.env.USE_POSTGRES ?? '').toLowerCase() === 'true';
}

/** Quote an identifier (table/column) defensively. Schema is generated, but quote anyway. */
function q(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

/** Convert a pg row to the Sheets-shaped Record<string,string>. All values to string. */
function toRecord(row: Record<string, unknown>, headers: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) {
    const v = row[h];
    out[h] = v === null || v === undefined ? '' : String(v);
  }
  return out;
}

/** Read a whole tab. Returns rows keyed by header (excluding __rownum). */
export async function pgReadTab<T = Record<string, string>>(
  tab: string,
  headers: string[]
): Promise<T[]> {
  const p = getPgPool();
  const res: QueryResult = await p.query(
    `SELECT ${headers.map(q).join(', ')} FROM ${q(tab)} ORDER BY __rownum ASC`
  );
  return res.rows.map((r) => toRecord(r, headers) as T);
}

/** Append rows. Returns the 1-based starting __rownum of the inserted block. */
export async function pgAppendRows(
  tab: string,
  headers: string[],
  rows: Record<string, string>[]
): Promise<number> {
  if (rows.length === 0) return -1;
  const p = getPgPool();
  const cols = headers.map(q).join(', ');
  const values: string[] = [];
  const tuples: string[] = [];
  let i = 0;
  for (const r of rows) {
    const params: string[] = [];
    for (const h of headers) {
      values.push(r[h] ?? '');
      params.push(`$${++i}`);
    }
    tuples.push(`(${params.join(', ')})`);
  }
  const res: QueryResult<{ __rownum: string }> = await p.query(
    `INSERT INTO ${q(tab)} (${cols}) VALUES ${tuples.join(', ')} RETURNING __rownum`,
    values
  );
  return res.rows.length > 0 ? Number(res.rows[0].__rownum) : -1;
}

/** Update the row whose __rownum === rowNumber. Values keyed by column header. */
export async function pgUpdateRow(
  tab: string,
  headers: string[],
  rowNumber: number,
  values: Record<string, string>
): Promise<void> {
  const p = getPgPool();
  // Build SET clause covering every header so writes are deterministic (Sheets
  // update overwrites the full row width with '' for missing keys).
  const setParts: string[] = [];
  const params: unknown[] = [rowNumber];
  let i = 1;
  for (const h of headers) {
    params.push(values[h] ?? '');
    setParts.push(`${q(h)} = $${++i}`);
  }
  await p.query(`UPDATE ${q(tab)} SET ${setParts.join(', ')} WHERE __rownum = $1`, params);
}

/** Find the row whose keyCol === value. Returns Sheets-style { rowNumber, row }. */
export async function pgFindRow(
  tab: string,
  headers: string[],
  keyCol: string,
  value: string
): Promise<{ rowNumber: number; row: Record<string, string> } | null> {
  if (!headers.includes(keyCol)) throw new Error(`Column ${keyCol} not in ${tab}`);
  const p = getPgPool();
  const res: QueryResult = await p.query(
    `SELECT __rownum, ${headers.map(q).join(', ')} FROM ${q(tab)} WHERE ${q(keyCol)} = $1 LIMIT 1`,
    [value]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return { rowNumber: Number(r.__rownum), row: toRecord(r, headers) };
}
