'use strict';
/**
 * Deploy-time PostgreSQL contract gate for YKP HR V1.
 *
 * Run with the app dir as cwd (pg + typescript already installed there):
 *
 *   USE_POSTGRES=true DATABASE_URL='<provided by caller>' node scripts/verify-pg-contract.cjs [appDir]
 *
 * What it does:
 *  1. Refuses unless USE_POSTGRES=true and DATABASE_URL is set (never silently
 *     passing against the Sheets fallback, never logging credentials).
 *  2. Extracts the ACTUAL TABS/TAB_HEADERS contract from src/db/sheets.ts via
 *     the TypeScript compiler AST (same technique as the incident
 *     inspect-contract.cjs) — no duplicated header lists to drift.
 *  3. Opens the caller-provided DATABASE_URL read-only
 *     (SET default_transaction_read_only=on + 5s statement timeout) and, for
 *     EVERY tab, checks information_schema for all expected headers plus
 *     __rownum AND runs SELECT <headers> ... ORDER BY __rownum LIMIT 0.
 *  4. Prints sanitized JSON (tab identifiers, missing column names, SQLSTATE
 *     codes only — never connection strings, hosts, or raw error text) and
 *     exits 0 when every tab verifies, 1 otherwise. Issues SELECT/SET only;
 *     never writes.
 *
 * No production host, database name, or filesystem path is hardcoded:
 * appDir defaults to process.cwd() and DATABASE_URL comes from the caller.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

/** Quote a table/column identifier defensively. */
function quoteIdent(name) {
  if (typeof name !== 'string' || name.length === 0) throw new Error('INVALID_IDENTIFIER');
  return '"' + name.replace(/"/g, '""') + '"';
}

/** Reduce a pg error to a log-safe SQLSTATE code. Never returns err.message. */
function sanitizePgError(err) {
  const code = err && typeof err.code === 'string' ? err.code : '';
  if (/^[0-9A-Z]{2,10}$/.test(code)) return code;
  return 'QUERY_FAILED';
}

function codedError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/**
 * Guard the deploy backend. Returns the caller-provided connection string.
 * Throws coded errors whose messages never echo env values.
 */
function checkEnv(env) {
  const usePg = String((env && env.USE_POSTGRES) || '').toLowerCase();
  if (usePg !== 'true') {
    throw codedError(
      'USE_POSTGRES_NOT_ENABLED',
      'Refusing to verify: USE_POSTGRES is not "true". Set USE_POSTGRES=true so the gate checks Postgres, not the Sheets fallback.'
    );
  }
  const url = env && env.DATABASE_URL;
  if (typeof url !== 'string' || url.length === 0) {
    throw codedError(
      'DATABASE_URL_MISSING',
      'DATABASE_URL is not set. Provide it via the environment; it is never logged.'
    );
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_ignored) {
    throw codedError('DATABASE_URL_INVALID', 'DATABASE_URL is not a valid URL.');
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw codedError('DATABASE_URL_INVALID', 'DATABASE_URL must use the postgres:// scheme.');
  }
  return url;
}

/**
 * Extract { TABS, TAB_HEADERS } from sheets.ts source text using the
 * TypeScript compiler AST (finds the real const declarations, transpiles just
 * those, evaluates in a sandbox). `ts` is injected so tests can pass a stub
 * and the CLI can use the app's installed typescript.
 */
function extractContractFromSource(sourceText, ts) {
  if (!ts) throw codedError('TYPESCRIPT_NOT_AVAILABLE', 'The typescript module is required to extract the contract.');
  if (typeof sourceText !== 'string' || sourceText.length === 0) {
    throw codedError('CONTRACT_SOURCE_UNREADABLE', 'Empty contract source.');
  }
  const filename = 'sheets.ts';
  const ast = ts.createSourceFile(filename, sourceText, ts.ScriptTarget.Latest, true);
  const selected = [];
  for (const stmt of ast.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        const name = d.name && typeof d.name.getText === 'function' ? d.name.getText(ast) : '';
        if (name === 'TABS' || name === 'TAB_HEADERS') selected.push('const ' + d.getText(ast) + ';');
      }
    }
  }
  if (selected.length !== 2) {
    throw codedError('CONTRACT_CONSTANTS_UNRECOGNIZED', 'Could not locate TABS and TAB_HEADERS in sheets.ts.');
  }
  const code = ts.transpileModule(selected.join('\n') + ';globalThis.__contract={TABS,TAB_HEADERS};', {
    compilerOptions: { target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const ctx = {};
  vm.runInNewContext(code, ctx, { timeout: 1000 });
  const contract = ctx.__contract;
  if (!contract || typeof contract.TABS !== 'object' || typeof contract.TAB_HEADERS !== 'object') {
    throw codedError('CONTRACT_CONSTANTS_UNRECOGNIZED', 'Contract extraction produced no usable constants.');
  }
  return { TABS: contract.TABS, TAB_HEADERS: contract.TAB_HEADERS };
}

/** Load the actual contract from <appDir>/src/db/sheets.ts. No hardcoded paths. */
function loadContract(appDir) {
  const localRequire = createRequire(path.join(appDir, 'package.json'));
  let ts;
  try {
    ts = localRequire('typescript');
  } catch (_ignored) {
    throw codedError('TYPESCRIPT_NOT_AVAILABLE', 'typescript is not installed for the app; cannot extract the contract.');
  }
  const filename = path.join(appDir, 'src', 'db', 'sheets.ts');
  let source;
  try {
    source = fs.readFileSync(filename, 'utf8');
  } catch (_ignored) {
    throw codedError('CONTRACT_SOURCE_UNREADABLE', 'Cannot read src/db/sheets.ts under the app directory.');
  }
  return extractContractFromSource(source, ts);
}

/**
 * Verify every contracted tab against an already-connected pg client.
 * Only issues SET + SELECT; never writes. Returns
 * { ok, checked, failed: [{ tab, missing, selectOk, sqlstate }] } where
 * sqlstate is a sanitized code (never raw error text).
 */
async function verifyWithClient(client, TABS, TAB_HEADERS) {
  if (!client || typeof client.query !== 'function') throw codedError('INVALID_CLIENT', 'A pg client with .query() is required.');
  const tabNames = Object.values(TABS || {});
  if (tabNames.length === 0) throw codedError('CONTRACT_EMPTY', 'Empty TABS contract.');
  await client.query('SET default_transaction_read_only=on');
  await client.query("SET statement_timeout='5s'");
  const actual = await client.query(
    'SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()'
  );
  const presentByTable = new Map();
  for (const r of (actual && actual.rows) || []) {
    if (!r || typeof r.table_name !== 'string' || typeof r.column_name !== 'string') continue;
    if (!presentByTable.has(r.table_name)) presentByTable.set(r.table_name, new Set());
    presentByTable.get(r.table_name).add(r.column_name);
  }
  const failed = [];
  for (const tab of tabNames) {
    const expected = TAB_HEADERS ? TAB_HEADERS[tab] : undefined;
    if (!Array.isArray(expected)) {
      failed.push({ tab, missing: [], selectOk: false, sqlstate: 'MISSING_HEADER_CONTRACT' });
      continue;
    }
    const present = presentByTable.get(tab) || new Set();
    const missing = [...expected, '__rownum'].filter((c) => !present.has(c));
    let selectOk = false;
    let sqlstate = null;
    try {
      await client.query(
        `SELECT ${expected.map(quoteIdent).join(', ')} FROM ${quoteIdent(tab)} ORDER BY ${quoteIdent('__rownum')} LIMIT 0`
      );
      selectOk = true;
    } catch (e) {
      sqlstate = sanitizePgError(e);
    }
    if (missing.length > 0 || !selectOk) failed.push({ tab, missing, selectOk, sqlstate });
  }
  return { ok: failed.length === 0, checked: tabNames.length, failed };
}

async function defaultConnect(appDir, connectionString) {
  const localRequire = createRequire(path.join(appDir, 'package.json'));
  let Client;
  try {
    ({ Client } = localRequire('pg'));
  } catch (_ignored) {
    throw codedError('PG_NOT_AVAILABLE', 'pg is not installed for the app.');
  }
  const db = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  await db.connect();
  return db;
}

/** Full gate: env guard -> actual contract -> read-only verify. `connect` is injectable for offline tests. */
async function runGate({ env = process.env, appDir = process.cwd(), connect } = {}) {
  const connectionString = checkEnv(env);
  const { TABS, TAB_HEADERS } = loadContract(appDir);
  const client = connect ? await connect(connectionString) : await defaultConnect(appDir, connectionString);
  try {
    return await verifyWithClient(client, TABS, TAB_HEADERS);
  } finally {
    if (client && typeof client.end === 'function') {
      try {
        await client.end();
      } catch (_ignored) {
        /* ignore close errors */
      }
    }
  }
}

async function main() {
  const appDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  try {
    const result = await runGate({ appDir });
    if (result.ok) {
      console.log(JSON.stringify({ ok: true, checked: result.checked }));
      process.exitCode = 0;
    } else {
      // Sanitized deploy log: tab identifiers, missing column names, SQLSTATE
      // codes only. Never DATABASE_URL, hosts, or raw error text.
      console.error(
        JSON.stringify(
          { ok: false, checked: result.checked, failed: result.failed.map((f) => f.tab), details: result.failed },
          null,
          2
        )
      );
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: (e && e.code) || 'VERIFY_FAILED' }));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  quoteIdent,
  sanitizePgError,
  checkEnv,
  extractContractFromSource,
  loadContract,
  verifyWithClient,
  runGate
};
