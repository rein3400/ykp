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
import { pollUpdates, sendMessage, sendToOwners, downloadFile, getMe, sendMessageWithKeyboard, sendLocationPrompt, answerCallbackQuery, type TgMessage, type TgCallbackQuery } from './telegram.js';
import { handleText, executeTool } from './brain.js';
import { chat } from './openrouter.js';
import { runDailyBrief } from './brief.js';
import { evaluateRules } from './watch.js';
import { isLinkCommand, handleLinkCommand, isMeCommand, handleMeCommand, isClockInCommand, handleClockIn, isClockOutCommand, handleClockOut, isAttendanceCommand, attendanceKeyboard, isScheduleCommand, handleScheduleCommand, isLeaveCommand, handleLeaveCommand, isStartCommand, isHelpCommand, employeeHelpText, mainMenuKeyboard, isStartLinkCommand, handleStartLink } from './link.js';

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
  const fromId = msg.from?.id ?? msg.chat.id;

  // `/link <code>` is allowed for ANYONE (staff/HOD linking their Telegram).
  if (msg.text && isLinkCommand(msg.text)) {
    const reply = await handleLinkCommand(msg.text, fromId);
    await sendMessage(chatId, reply);
    // After a successful link, show the main menu so the user can tap.
    if (reply.startsWith('✅')) {
      await sendMessageWithKeyboard(chatId, 'Pilih menu:', mainMenuKeyboard());
    }
    return;
  }

  // `/me` self-service for linked staff/HOD (their own HR data).
  if (msg.text && isMeCommand(msg.text)) {
    const reply = await handleMeCommand(fromId);
    await sendMessage(chatId, reply);
    return;
  }

  // `/clock-in` / `/clock-out` for linked staff/HOD.
  if (msg.text && isClockInCommand(msg.text)) {
    const reply = await handleClockIn(fromId);
    await sendMessage(chatId, reply);
    return;
  }
  if (msg.text && isClockOutCommand(msg.text)) {
    const reply = await handleClockOut(fromId);
    await sendMessage(chatId, reply);
    return;
  }

  // `/absen` shows the attendance menu (inline buttons).
  if (msg.text && isAttendanceCommand(msg.text)) {
    await sendMessageWithKeyboard(chatId, 'Pilih aksi absensi:', attendanceKeyboard());
    return;
  }

  // `/jadwal` — view own schedule.
  if (msg.text && isScheduleCommand(msg.text)) {
    const reply = await handleScheduleCommand(fromId);
    await sendMessage(chatId, reply);
    return;
  }

  // `/cuti` — submit a leave request.
  if (msg.text && isLeaveCommand(msg.text)) {
    const reply = await handleLeaveCommand(msg.text, fromId);
    await sendMessage(chatId, reply);
    return;
  }

  // Deep-link: `/start KODE` (from t.me/<bot>?start=KODE) — connect without typing.
  if (msg.text && isStartLinkCommand(msg.text)) {
    const reply = await handleStartLink(msg.text, fromId);
    await sendMessage(chatId, reply);
    // After a successful link, show the main menu so the user can tap.
    if (reply.startsWith('✅')) {
      await sendMessageWithKeyboard(chatId, 'Pilih menu:', mainMenuKeyboard());
    }
    return;
  }

  // `/start` and `/help` — show the employee main menu (for ANYONE).
  if (msg.text && (isStartCommand(msg.text) || isHelpCommand(msg.text))) {
    await sendMessageWithKeyboard(chatId, employeeHelpText(), mainMenuKeyboard());
    return;
  }

  // A Telegram location message = clock-in with GPS (for linked staff/HOD).
  if (msg.location) {
    const reply = await handleClockIn(fromId, msg.location);
    await sendMessage(chatId, reply);
    return;
  }

  if (!isOwner(msg)) {
    await sendMessage(chatId, 'Maaf, saya hanya melayani owner YKP. 🙏\n\nKaryawan/HOD: ketik /start untuk menu, /link KODE untuk menghubungkan akun.');
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

async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat.id;
  const fromId = cb.from.id;
  const data = cb.data ?? '';
  if (chatId === undefined) return;

  // Main menu navigation.
  if (data === 'main:menu') {
    await answerCallbackQuery(cb.id, 'Menu utama');
    await sendMessageWithKeyboard(chatId, employeeHelpText(), mainMenuKeyboard());
    return;
  }
  if (data === 'main:absen') {
    await answerCallbackQuery(cb.id, 'Menu absen');
    await sendMessageWithKeyboard(chatId, 'Pilih aksi absensi:', attendanceKeyboard());
    return;
  }
  if (data === 'main:jadwal') {
    await answerCallbackQuery(cb.id, 'Jadwal…');
    const reply = await handleScheduleCommand(fromId);
    await sendMessage(chatId, reply);
    return;
  }
  if (data === 'main:cuti') {
    await answerCallbackQuery(cb.id, 'Cuti…');
    await sendMessage(chatId, 'Cara ajukan cuti:\n<b>/cuti JENIS TANGGAL_MULAI TANGGAL_SELESAI [alasan]</b>\n\nJenis: ANNUAL_LEAVE, SICK, PERMISSION, UNPAID_LEAVE, EMERGENCY, MATERNITY, OTHER\n\nContoh: /cuti SICK 2026-08-20 2026-08-21 Demam');
    return;
  }
  if (data === 'main:me') {
    await answerCallbackQuery(cb.id, 'Profil…');
    const reply = await handleMeCommand(fromId);
    await sendMessage(chatId, reply);
    return;
  }
  if (data === 'main:help') {
    await answerCallbackQuery(cb.id, 'Bantuan');
    await sendMessageWithKeyboard(chatId, employeeHelpText(), mainMenuKeyboard());
    return;
  }

  if (data === 'att:clock-in') {
    await answerCallbackQuery(cb.id, 'Clock-in…');
    const reply = await handleClockIn(fromId);
    await sendMessage(chatId, reply);
    return;
  }
  if (data === 'att:clock-out') {
    await answerCallbackQuery(cb.id, 'Clock-out…');
    const reply = await handleClockOut(fromId);
    await sendMessage(chatId, reply);
    return;
  }
  if (data === 'att:location') {
    await answerCallbackQuery(cb.id, 'Kirim lokasi kamu');
    await sendLocationPrompt(chatId, '📍 Kirim lokasi kamu untuk clock-in dengan deteksi GPS. Tekan tombol di bawah.');
    return;
  }
  await answerCallbackQuery(cb.id, 'Perintah tidak dikenal');
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
      if (u.callback_query) void handleCallback(u.callback_query);
    }
    await saveOffset(offset);
  }
}

void main();
