// ERP connector placeholder — integration pending per MVP3.F
// Interface siap; tinggal diisi adapter ERP spesifik (Accurate, Jurnal, Mekari, dll)

import { logger } from '../services/logger.js';

export interface ErpSyncResult {
  ok: boolean;
  connector: string;
  recordsAffected: number;
  message: string;
}

export async function syncOutletsToErp(): Promise<ErpSyncResult> {
  logger.info('erp.syncOutlets (stub)');
  return { ok: false, connector: 'none', recordsAffected: 0, message: 'ERP connector belum terkonfigurasi.' };
}

export async function pushSalesToErp(_date: string): Promise<ErpSyncResult> {
  logger.info('erp.pushSales (stub)');
  return { ok: false, connector: 'none', recordsAffected: 0, message: 'ERP connector belum terkonfigurasi.' };
}