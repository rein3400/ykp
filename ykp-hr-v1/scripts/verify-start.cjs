'use strict';
/** Block startup if the live HR PostgreSQL contract is missing or misconfigured. */
const { loadEnvConfig } = require('@next/env');
const { runGate, sanitizePgError } = require('./verify-pg-contract.cjs');
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
runGate().then(result => {
  console.log(JSON.stringify({ check: 'hr-postgres-contract', ...result }));
  if (!result.ok) process.exitCode = 1;
}).catch(error => {
  console.error(JSON.stringify({ check: 'hr-postgres-contract', ok: false, error: sanitizePgError(error) }));
  process.exitCode = 1;
});
