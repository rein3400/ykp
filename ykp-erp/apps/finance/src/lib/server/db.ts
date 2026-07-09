/**
 * Server-side DB bootstrap. Initialises all four logical DB clients once
 * per server process (idempotent) and exposes typed accessors for route
 * handlers. Per-request usage: read the clients via getMasterDb() etc. —
 * the underlying postgres connections are pooled by postgres-js.
 *
 * Apps call initDbClients() at module load so any missing DATABASE_URL
 * env var surfaces at boot, not on the first request.
 */
import { initDbClients } from "@ykp/schema";

initDbClients();

export {
  getMasterDb,
  getHrDb,
  getFinanceDb,
  getHermezDb,
  getDb,
  financeSql,
  masterSql,
  type MasterDb,
  type FinanceDb,
  type HermezDb,
} from "@ykp/schema";