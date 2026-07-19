/**
 * Hermez service entry: Telegram long-polling + scheduler.
 * - Owner whitelist enforced here (non-owners get one polite refusal).
 * - Voice notes → transcription (lite model) → handled as text.
 * - Photos → multimodal analysis (full model with vision).
 * - Scheduler: AI daily brief at 22:05 WIB, watch rules every 30 min.
 * - DRY-RUN (no bot token): everything logs, nothing sends.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG, DRY_RUN, todayWib, wibHourMinute } from './config.js';
import { pollUpdates, sendMessage, sendToOwners, downloadFile, getMe, type TgMessage } from './telegram.js';
import { handleText, executeTool } from './brain.js';
import { chat } from './openrouter.js';
import { runDailyBrief } from './brief.js';
import { evaluateRules } from './watch.js';

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

function isOwner(msg: TgMessage): boolean {
  const id = msg.from?.id ?? msg.chat.id;
  return CONFIG.ownerIds.includes(String(id));
}

async function transcribeVoice(fileId: string): Promise<string> {
  const { data } = await downloadFile(fileId);
  const result = await chat(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transkripsikan pesan suara ini (Bahasa Indonesia). Jawab HANYA dengan teks transkripsinya, tanpa komentar.' },
          { type: 'input_audio', input_audio: { data: data.toString('base64'), format: 'ogg' } }
        ]
      }
    ],
    undefined,
    CONFIG.liteModel
  );
  return result.content.trim();
}

async function handleMessage(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  if (!isOwner(msg)) {
    await sendMessage(chatId, 'Maaf, saya hanya melayani owner YKP. 🙏');
    return;
  }
  try {
    if (msg.voice) {
      await sendMessage(chatId, '🎙 Mendengarkan…');
      const transcript = await transcribeVoice(msg.voice.file_id);
      if (!transcript) {
        await sendMessage(chatId, 'Tidak bisa mendengar dengan jelas — coba ketik saja ya.');
        return;
      }
      const reply = await handleText(chatId, transcript);
      await sendMessage(chatId, `🎙 <i>"${transcript}"</i>\n\n${reply}`);
      return;
    }
    if (msg.photo && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1];
      const { data } = await downloadFile(largest.file_id);
      const reply = await handleText(chatId, msg.caption ?? '', data.toString('base64'));
      await sendMessage(chatId, reply);
      return;
    }
    if (msg.text) {
      const reply = await handleText(chatId, msg.text);
      await sendMessage(chatId, reply);
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
  const me = await getMe();
  console.log(`[hermez] starting as @${me} | owners: ${CONFIG.ownerIds.length} | dry-run: ${DRY_RUN}`);
  if (CONFIG.ownerIds.length === 0) {
    console.warn('[hermez] WARNING: TELEGRAM_OWNER_IDS empty — nobody will be answered.');
  }

  const state = { lastBriefDate: '', lastWatchRun: 0 };
  setInterval(() => void scheduler(state), 30_000);

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
    }
    await saveOffset(offset);
  }
}

void main();
