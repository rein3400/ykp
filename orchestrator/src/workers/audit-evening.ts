import { reconcileClosedTrades } from '../modules/trade-auditor.js';
import { logger } from '../services/logger.js';

export async function runAuditEvening(): Promise<void> {
  logger.info('audit-evening worker running');
  await reconcileClosedTrades();
}
