/**
 * Hermez service entry: Telegram long-polling + scheduler.
 * - Owner + department-head gate enforced here (others get one refusal).
 * - Text → LLM tool-use agent loop (deepseek-v4-flash, text-only).
 * - Photo → vision model (minimax-m3 via Ollama Cloud) with tool access.
 * - Voice → polite "not supported" reply (audio input is out of scope).
 * - Callback queries → approval-button decisions relayed to source modules.
 * - Scheduler: AI daily brief at 22:05 WIB, watch rules every 30 min.
 * - DRY-RUN (no bot token): everything logs, nothing sends.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG, DRY_RUN, todayWib, wibHourMinute } from './config.js';
import { pollUpdates, sendMessage, sendMessagePlain, sendToOwners, getMe, downloadFile, type TgMessage } from './telegram.js';
import { handleText, executeTool } from './brain.js';
import { runDailyBrief } from './brief.js';
import { evaluateRules } from './watch.js';
import { resolveActor, isAllowedRole, scopeFor, type Actor } from './actor.js';
import { startGateway } from './gateway.js';
import { processCallbackUpdate } from './approval.js';

const OFFSET_FILE = () => join(CONFIG.dataDir, 'offset.txt');

async function loadOffset(): Promise<number> {
  try {
    return Number(await readFile(OFFSET_FILE(), 'utf8')) || 0;
  } catch {
    return 0;
  }
}
async function saveOffset(offset: number): Promise<void> {
  await mkdir(CONFIG.dataDir, { recursive: true });
  await writeFile(OFFSET_FILE(), String(offset));
}

/** Resolve the sender to an RBAC actor and enforce the owner/head gate. */
async function resolveAllowedActor(msg: TgMessage): Promise<Actor | null> {
  const id = msg.from?.id ?? msg.chat.id;
  const idStr = String(id);
  // Hard allowlist (if configured) is the single source of truth.
  if (CONFIG.allowedIds.length > 0) {
    if (!CONFIG.allowedIds.includes(idStr)) return null;
    return { userId: `TG-${id}`, role: 'owner', brandId: '', outletId: '', employeeId: '' };
  }
  // Owner whitelist (env) always wins — no HR lookup needed.
  if (CONFIG.ownerIds.includes(idStr)) {
    return { userId: `TG-${id}`, role: 'owner', brandId: '', outletId: '', employeeId: '' };
  }
  const actor = await resolveActor(id);
  if (!actor) return null;
  if (!isAllowedRole(actor.role)) return null;
  return actor;
}

// ── Per-chat rate limiting (anti token-burn spam) ────────────────────

interface RateEntry { count: number; windowStart: number }
const rateState = new Map<number, RateEntry>();

function rateLimited(chatId: number): boolean {
  const now = Date.now();
  const e = rateState.get(chatId);
  if (!e || now - e.windowStart > CONFIG.rateLimitWindowMs) {
    rateState.set(chatId, { count: 1, windowStart: now });
    return false;
  }
  e.count += 1;
  return e.count > CONFIG.rateLimitMax;
}

async function handleMessage(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const actor = await resolveAllowedActor(msg);
  if (!actor) {
    await sendMessage(chatId, 'Maaf, saya hanya melayani owner dan kepala bagian YKP. 🙏');
    return;
  }
  if (rateLimited(chatId)) {
    await sendMessage(chatId, 'Terlalu banyak pesan. Tunggu sebentar ya.');
    return;
  }
  const scope = scopeFor(actor);
  try {
    if (msg.voice) {
      await sendMessage(chatId, 'Maaf, model AI saat ini belum mendukung pesan suara. Ketik pertanyaan Anda ya.');
      return;
    }
    if (msg.photo && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1];
      const { data } = await downloadFile(largest.file_id);
      const caption = msg.caption ?? '';
      const reply = await handleText(chatId, caption, data.toString('base64'), scope);
      await sendMessagePlain(chatId, reply);
      return;
    }
    if (msg.text) {
      const reply = await handleText(chatId, msg.text, undefined, scope);
      await sendMessagePlain(chatId, reply);
    }
  } catch (e) {
    console.error('[hermez] message handling failed:', e);
    await sendMessage(chatId, '⚠️ Ada gangguan di sistem saya. Coba lagi sebentar lagi.').catch(() => undefined);
  }
}

async function scheduler(state: { lastBriefDate: string; lastWatchRun: number }): Promise<void> {
  const { hour, minute } = wibHourMinute();
  const today = todayWib();

  // AI daily brief, once per day at the configured WIB time.
  if (!DRY_RUN && hour === CONFIG.briefHour && minute >= CONFIG.briefMinute && state.lastBriefDate !== today) {
    state.lastBriefDate = today;
    try {
      await runDailyBrief();
    } catch (e) {
      console.error('[scheduler] brief failed:', e);
      state.lastBriefDate = ''; // retry next minute
    }
  }

  // Watch rules.
  if (Date.now() - state.lastWatchRun > CONFIG.watchEvalMinutes * 60_000) {
    state.lastWatchRun = Date.now();
    try {
      const fired = await evaluateRules(executeTool);
      for (const f of fired) await sendToOwners(f.text);
    } catch (e) {
      console.error('[scheduler] watch eval failed:', e);
    }
  }
}

async function main(): Promise<void> {
  if (process.env.TELEGRAM_OPEN_ACCESS === 'true') {
    console.error('[hermez] REFUSING TO START: TELEGRAM_OPEN_ACCESS=true is a removed auth-bypass footgun. Delete it from .env.');
    process.exit(1);
  }
  const me = await getMe();
  console.log(`[hermez] starting as @${me} | owners: ${CONFIG.ownerIds.length} | dry-run: ${DRY_RUN}`);
  if (CONFIG.ownerIds.length === 0) {
    console.warn('[hermez] WARNING: TELEGRAM_OWNER_IDS empty — nobody will be answered.');
  }

  const state = { lastBriefDate: '', lastWatchRun: 0 };
  setInterval(() => void scheduler(state), 30_000);

  // Outbound notification gateway (module apps POST here for fan-out).
  startGateway();

  if (DRY_RUN) {
    console.log('[hermez] dry-run mode: polling disabled. Set TELEGRAM_BOT_TOKEN to go live.');
    return;
  }

  let offset = await loadOffset();
  let backoff = 1000;
  for (;;) {
    const updates = await pollUpdates(offset, 30);
    if (updates.length === 0) {
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 1.5, 15_000);
      continue;
    }
    backoff = 1000;
    for (const u of updates) {
      offset = u.update_id + 1;
      if (u.message) void handleMessage(u.message);
      if (u.callback_query) void processCallbackUpdate(u.callback_query);
    }
    await saveOffset(offset);
  }
}

void main();
