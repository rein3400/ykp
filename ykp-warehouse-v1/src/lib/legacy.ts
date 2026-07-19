/**
 * Legacy F1–F5 write gate (Review Cycle 2, deprecation layer).
 *
 * The legacy flat forms (F1 penerimaan / F3 bon pemakaian / F5 closing) are
 * deprecated in favour of the structured flows (receiving, stock issue,
 * stock count). Legacy POST APIs stay enabled by default for backward
 * compatibility; set WAREHOUSE_LEGACY_WRITES_ENABLED=false to hard-disable
 * them — every legacy write then returns HTTP 410 Gone with a pointer to
 * the new flow. Reads (migration views) are unaffected.
 */
import { fail } from './http';

export function legacyWritesEnabled(): boolean {
  return (process.env.WAREHOUSE_LEGACY_WRITES_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
}

export function legacyWritesDisabledResponse() {
  return fail(
    'legacy_writes_disabled',
    'Mode legacy dinonaktifkan — gunakan alur baru (Receiving / Stock Issue / Stock Opname). '
      + 'Set WAREHOUSE_LEGACY_WRITES_ENABLED=true untuk mengaktifkan kembali sementara.',
    410
  );
}
