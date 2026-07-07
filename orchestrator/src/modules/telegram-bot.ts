import { Bot, type Context, type NextFunction } from 'grammy';
import { eq, desc } from 'drizzle-orm';
import { env } from '../config/env.js';
import { getUserByTelegramId, canAccess } from './auth.js';
import { handleStatus } from './owner-bot.js';
import { handleSop } from './sop-bot.js';
import { sendTelegram } from '../services/telegram.js';
import { logger } from '../services/logger.js';
import { db, schema } from '../db/index.js';
import { ragQuery } from './knowledge-search.js';
import { runAgent, AGENTS } from './agents.js';
import type { User } from '../db/schema.js';

type CtxWithUser = Context & { ykpUser?: User };

let botInstance: Bot | null = null;

export function getBot(): Bot {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }
  if (!botInstance) {
    botInstance = new Bot(env.TELEGRAM_BOT_TOKEN);
    registerHandlers(botInstance);
  }
  return botInstance;
}

function registerHandlers(bot: Bot): void {
  bot.use(authMiddleware);

  bot.command('start', (ctx) => ctx.reply('YKP AI Orchestrator aktif. Kirim /help untuk daftar command.'));

  bot.command('help', (ctx) => ctx.reply(`Command tersedia:
/status - status server
/omzet hari ini - omzet per outlet
/report - daily summary
/hr telat hari ini - karyawan telat
/finance minggu ini - finance report
/sop <pertanyaan> - cari SOP
/trading - info trading setup
/signals - signal trading terakhir
/journal - daftar trading journal terakhir
/knowledge <query> - RAG ke knowledge base ICT
/agent <id> <query> - tanya 5 agent (ict_mentor|news_analyst|risk_manager|trade_auditor|psychology_coach)
/help - bantuan`));

  bot.command('status', guardRole('/status'), async (ctx) => {
    const text = await handleStatus();
    await ctx.reply(text);
  });

  bot.command('omzet', guardRole('/omzet'), async (ctx) => {
    const { handleOmzet } = await import('./owner-bot.js');
    const text = await handleOmzet('hari ini');
    await ctx.reply(text);
  });

  bot.command('report', guardRole('/report'), async (ctx) => {
    const { handleReport } = await import('./owner-bot.js');
    const text = await handleReport();
    await ctx.reply(text);
  });

  bot.command('hr', guardRole('/hr'), async (ctx) => {
    const { handleHr } = await import('./hr-bot.js');
    const args = ctx.match?.toString().trim() || 'telat hari ini';
    const text = await handleHr(args);
    await ctx.reply(text);
  });

  bot.command('finance', guardRole('/finance'), async (ctx) => {
    const { handleFinance } = await import('./finance-bot.js');
    const args = ctx.match?.toString().trim() || 'minggu ini';
    const text = await handleFinance(args);
    await ctx.reply(text);
  });

  bot.command('sop', guardRole('/sop'), async (ctx) => {
    const query = ctx.match?.toString().trim() || '';
    const text = await handleSop(query);
    await ctx.reply(text);
  });

  bot.command('trading', guardRole('/trading'), async (ctx) => {
    const { handleTrading } = await import('./trading-engine.js');
    const text = await handleTrading();
    await ctx.reply(text);
  });

  bot.command('signals', guardRole('/signals'), async (ctx) => {
    const rows = await db.select().from(schema.tradingSetups)
      .orderBy(desc(schema.tradingSetups.createdAt))
      .limit(10);
    if (rows.length === 0) {
      await ctx.reply('Belum ada signal.');
      return;
    }
    const lines = rows.map((r) => {
      const score = r.score ? ` [score=${r.score}]` : '';
      return `${r.pair} ${r.timeframe} — ${r.status} (${r.bias})${score} · ${r.createdAt.toISOString()}`;
    });
    await ctx.reply(`<b>10 Signal Terakhir</b>\n${lines.join('\n')}`, { parse_mode: 'HTML' });
  });

  bot.command('knowledge', guardRole('/knowledge'), async (ctx) => {
    const query = ctx.match?.toString().trim() || '';
    if (!query) {
      await ctx.reply('Cara pakai: /knowledge <query>. Contoh: /knowledge FVG');
      return;
    }
    try {
      const rag = await ragQuery(query, 5);
      if (rag.hits.length === 0) {
        await ctx.reply(`Tidak ada hasil di knowledge base untuk: ${query}`);
        return;
      }
      const top = rag.hits[0]!;
      const header = `📚 <b>${top.payload.title}</b> (${top.payload.category})\nScore: ${top.score.toFixed(3)}\n\n`;
      await ctx.reply(header + top.payload.content.slice(0, 3500), { parse_mode: 'HTML' });
    } catch (err) {
      await ctx.reply(`RAG error: ${(err as Error).message}`);
    }
  });

  bot.command('agent', guardRole('/knowledge'), async (ctx) => {
    const args = ctx.match?.toString().trim() || '';
    const [agentId, ...rest] = args.split(/\s+/);
    if (!agentId || !AGENTS.includes(agentId as typeof AGENTS[number])) {
      await ctx.reply(`Cara pakai: /agent <${AGENTS.join('|')}> <query>`);
      return;
    }
    const query = rest.join(' ').trim();
    if (!query) {
      await ctx.reply('Query kosong.');
      return;
    }
    const text = await runAgent(agentId as typeof AGENTS[number], query, {
      userId: (ctx as CtxWithUser).ykpUser?.id
    });
    await ctx.reply(text.slice(0, 3500));
  });

  bot.command('journal', guardRole('/journal'), async (ctx) => {
    const { handleJournalCommand } = await import('./journal.js');
    const text = await handleJournalCommand(ctx.match?.toString().trim() ?? '');
    await ctx.reply(text);
  });

  // Phase 2: callback_query handler for approve/reject inline keyboards
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = (ctx as CtxWithUser).ykpUser?.id ?? ctx.from?.id?.toString() ?? 'unknown';
    try {
      if (data?.startsWith('approve:')) {
        const setupId = data.slice('approve:'.length);
        const { handleApproval } = await import('./approval.js');
        await handleApproval(setupId, 'approved', userId);
        await ctx.answerCallbackQuery({ text: '✅ Approved', show_alert: false });
        await ctx.editMessageText(`✅ <b>APPROVED</b>\nSetup ${setupId} approved by ${userId}.`, { parse_mode: 'HTML' });
      } else if (data?.startsWith('reject:')) {
        const setupId = data.slice('reject:'.length);
        const { handleApproval } = await import('./approval.js');
        await handleApproval(setupId, 'rejected', userId);
        await ctx.answerCallbackQuery({ text: '❌ Rejected', show_alert: false });
        await ctx.editMessageText(`❌ <b>REJECTED</b>\nSetup ${setupId} rejected by ${userId}.`, { parse_mode: 'HTML' });
      } else {
        await ctx.answerCallbackQuery();
      }
    } catch (err) {
      logger.error({ err, data }, 'callback_query handler failed');
      await ctx.answerCallbackQuery({ text: `Error: ${(err as Error).message}`, show_alert: true });
    }
  });

  bot.on('message', async (ctx) => {
    if (ctx.message?.text?.startsWith('/')) return;
    if (ctx.chat?.type !== 'private') return;
    await ctx.reply('Maaf, saya hanya mengerti command. Kirim /help.');
  });

  bot.catch((err) => {
    logger.error({ err: err.error }, 'grammy error');
    try {
      const ctx = err.ctx;
      void ctx.reply('Terjadi error. Coba lagi atau hubungi owner.');
    } catch {
      // ignore
    }
  });
}

async function authMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const from = ctx.from;
  if (!from) {
    await ctx.reply('Identitas tidak terdeteksi.');
    return;
  }
  const user = await getUserByTelegramId(from.id);
  if (!user || !user.isActive) {
    logger.warn({ telegramId: from.id, username: from.username }, 'unauthorized telegram user');
    await ctx.reply('Access denied. Telegram ID belum terdaftar di whitelist.');
    return;
  }
  (ctx as CtxWithUser).ykpUser = user;
  await next();
}

function guardRole(command: string) {
  return async (ctx: Context, next: NextFunction) => {
    const user = (ctx as CtxWithUser).ykpUser;
    if (!user) {
      await ctx.reply('Identitas tidak ditemukan.');
      return;
    }
    if (!canAccess(user.role, command)) {
      await ctx.reply(`Command ${command} tidak diizinkan untuk role ${user.role}.`);
      return;
    }
    await next();
  };
}

export async function sendToOwner(text: string): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  return sendTelegram({ chatId: env.TELEGRAM_OWNER_CHAT_ID, text, parseMode: 'HTML' });
}

export async function startLongPolling(): Promise<void> {
  const bot = getBot();
  logger.info('Starting Telegram long-polling...');
  await bot.start({
    onStart: (botInfo) => logger.info({ botInfo }, 'Telegram bot started'),
    drop_pending_updates: true
  });
}

export async function setWebhook(url: string, secret?: string): Promise<void> {
  const bot = getBot();
  const info = await bot.api.getWebhookInfo();
  if (info.url === url) {
    logger.info({ url }, 'Telegram webhook already set');
    return;
  }
  logger.info({ url }, 'Registering Telegram webhook...');
  await bot.api.setWebhook(url, {
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true
  });
  logger.info({ url }, 'Telegram webhook registered');
}

export async function stopBot(): Promise<void> {
  await botInstance?.stop();
}