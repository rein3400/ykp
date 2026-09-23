/**
 * TEST-ONLY fake for `@/db/sheets` (payroll tab only).
 * Mimics the Postgres backend row-identity semantics: each stored row has an
 * explicit sparse `__rownum` (BIGSERIAL with gaps after deletes).
 * readTab() strips __rownum like pgReadTab; findRow() resolves stable
 * identity by key; updateRow() writes ONLY via __rownum and THROWS on a
 * missing row so tests fail fast if the route ever computes a wrong identity
 * (real pg would silently update 0 rows while the caller counted success).
 */
export const TABS = { payroll: 'hr_payroll' };

let live = [];
let snapshot = null; // when set, readTab serves this frozen copy (stale-snapshot tests)
export const __updateCalls = [];
export const __findCalls = [];

export function __setPayrollRows(list) {
  live = list.map((r) => ({ ...r }));
  snapshot = null;
  __updateCalls.length = 0;
  __findCalls.length = 0;
}

/** Override ONLY the live store (findRow/updateRow see this). */
export function __setLiveRows(list) {
  live = list.map((r) => ({ ...r }));
  __updateCalls.length = 0;
  __findCalls.length = 0;
}

/** Override ONLY what readTab returns (stale readTab snapshot). */
export function __setSnapshotRows(list) {
  snapshot = list.map((r) => ({ ...r }));
}

export function __getPayrollRows() {
  return live.map((r) => ({ ...r }));
}

function strip(row) {
  const { __rownum, ...rest } = row;
  return { ...rest };
}

export async function readTab(tab) {
  if (tab !== TABS.payroll) throw new Error(`fake: unexpected tab ${tab}`);
  return (snapshot ?? live).map(strip);
}

export async function findRow(tab, keyCol, value) {
  if (tab !== TABS.payroll) throw new Error(`fake: unexpected tab ${tab}`);
  __findCalls.push({ keyCol, value });
  const hit = live.find((r) => r[keyCol] === value);
  if (!hit) return null;
  return { rowNumber: hit.__rownum, row: strip(hit) };
}

export async function updateRow(tab, rowNumber, values) {
  if (tab !== TABS.payroll) throw new Error(`fake: unexpected tab ${tab}`);
  const hit = live.find((r) => r.__rownum === rowNumber);
  if (!hit) throw new Error(`fake: rowNumber ${rowNumber} does not exist (sparse __rownum trap)`);
  Object.assign(hit, { ...values });
  __updateCalls.push({ rowNumber, values: { ...values } });
}
