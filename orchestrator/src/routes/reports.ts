import type { FastifyInstance } from 'fastify';
import { handleOmzet, handleReport, handleStatus } from '../modules/owner-bot.js';
import { handleFinance } from '../modules/finance-bot.js';
import { handleHr } from '../modules/hr-bot.js';

export default async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reports/daily', async () => {
    const date = new Date().toISOString().slice(0, 10);
    return {
      date,
      status: await handleStatus(),
      omzet: await handleOmzet('hari ini'),
      hr: await handleHr('telat hari ini'),
      finance: await handleFinance('hari ini'),
      full: await handleReport()
    };
  });

  app.get('/reports/finance', async (req) => {
    const period = (req.query as { period?: string }).period ?? 'minggu ini';
    return { finance: await handleFinance(period) };
  });

  app.get('/reports/hr', async (req) => {
    const filter = (req.query as { filter?: string }).filter ?? 'telat hari ini';
    return { hr: await handleHr(filter) };
  });
}