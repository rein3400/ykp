import { sendToOwner } from '../modules/telegram-bot.js';
import { logger } from '../services/logger.js';

export async function runKnowledgeNudge(): Promise<void> {
  const msg = '🇮🇩 Senin — jadwal HERMES: tambahkan minimal 3 knowledge baru ke knowledge base. Gunakan POST /knowledge/ingest.';
  logger.info('knowledge nudge worker running');
  await sendToOwner(msg);
}
