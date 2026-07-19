// ============================================================
// @ykp/engine — Hermez Telegram dialog bot
// ------------------------------------------------------------
// Two-way Telegram bot: receives owner commands via getUpdates
// long-polling and replies with live summaries + LLM dialog.
// Credentials come from hermez_config (owner-set via UI), falling
// back to env vars. The bot only answers the configured owner
// chat/group; any other chat gets a polite refusal.
// ============================================================

import { createHermezDb, createHrDb, createFinanceDb, hermezDailyBrief, hermezAlertLog, hrDailySummary, finDailySummary } from "@ykp/schema";
import { desc, eq, sql } from "drizzle-orm";
import { sendTelegramMessage } from "./telegram";
import { resolveTelegramCredentials, resolveLlmSettings } from "./integrations";
import { todayWib } from "./client";

const API = "https://api.telegram.org";

export interface BotStatus {
  running: boolean;
  mode: "polling" | "stopped";
  lastUpdateId: number;
  lastError: string | null;
  startedAt: string | null;
  messagesHandled: number;
  pollCycles: number;
  updatesSeen: number;
  lastTgError: string | null;
}

const state: BotStatus = {
  running: false,
  mode: "stopped",
  lastUpdateId: 0,
  lastError: null,
  startedAt: null,
  messagesHandled: 0,
  pollCycles: 0,
  updatesSeen: 0,
  lastTgError: null,
};

export function getBotStatus(): BotStatus {
  return { ...state };
}

interface TgUser { id: number; first_name?: string; username?: string }
interface TgChat { id: number; type: string; title?: string }
interface TgMessage { message_id: number; from?: TgUser; chat: TgChat; text?: string; date: number }
interface TgUpdate { update_id: number; message?: TgMessage }

async function tgCall<T>(token: string, method: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(method === "getUpdates" ? 35_000 : 10_000),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) {
      state.lastError = `${method}: ${json.description ?? res.status}`;
      return null;
    }
    return json.result ?? null;
  } catch (e) {
    state.lastError = `${method}: ${e instanceof Error ? e.message : String(e)}`;
    return null;
  }
}

/** True when the incoming chat is the configured owner chat/group. */
function isAllowedChat(chatId: number | string, allowed: string): boolean {
  if (!allowed) return false;
  return String(chatId) === String(allowed).trim();
}

function fmtIdr(n: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;
}

function dateParam(args: string): string {
  const m = args.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : todayWib();
}

// ------------------------------------------------------------
// Command handlers
// ------------------------------------------------------------

async function cmdBrief(args: string): Promise<string> {
  const date = dateParam(args);
  const db = createHermezDb();
  const rows = await db
    .select()
    .from(hermezDailyBrief)
    .where(eq(hermezDailyBrief.date, new Date(date)))
    .limit(1);
  const brief = rows[0];
  if (!brief) return `Belum ada brief untuk ${date}. Generate via Run Console.`;
  return brief.briefText;
}

async function cmdOmzet(args: string): Promise<string> {
  const date = dateParam(args);
  const db = createFinanceDb();
  const rows = await db
    .select({
      outlet: finDailySummary.outlet,
      revenue: finDailySummary.revenue,
      expense: finDailySummary.expense,
    })
    .from(finDailySummary)
    .where(eq(finDailySummary.date, new Date(date)));
  if (!rows.length) return `Tidak ada data finance untuk ${date}.`;
  const totalRev = rows.reduce((a, r) => a + (r.revenue ?? 0), 0);
  const totalExp = rows.reduce((a, r) => a + (r.expense ?? 0), 0);
  const lines = rows
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .map((r) => `${r.outlet}: ${fmtIdr(r.revenue ?? 0)}`);
  return [
    `OMZET ${date}`,
    ...lines,
    `Total: ${fmtIdr(totalRev)}`,
    `Expense: ${fmtIdr(totalExp)}`,
    `Net estimate: ${fmtIdr(totalRev - totalExp)}`,
  ].join("\n");
}

async function cmdHr(args: string): Promise<string> {
  const date = dateParam(args);
  const db = createHrDb();
  const rows = await db
    .select({
      outlet: hrDailySummary.outlet,
      total: hrDailySummary.totalStaff,
      present: hrDailySummary.staffPresent,
      late: hrDailySummary.staffLate,
      absent: hrDailySummary.staffAbsent,
    })
    .from(hrDailySummary)
    .where(eq(hrDailySummary.date, new Date(date)));
  if (!rows.length) return `Tidak ada data HR untuk ${date}.`;
  const lines = rows.map(
    (r) => `${r.outlet}: hadir ${r.present}/${r.total}, telat ${r.late}, absen ${r.absent}`,
  );
  const totalLate = rows.reduce((a, r) => a + (r.late ?? 0), 0);
  const totalAbsent = rows.reduce((a, r) => a + (r.absent ?? 0), 0);
  return [`HR ${date}`, ...lines, `Total telat: ${totalLate}, absen: ${totalAbsent}`].join("\n");
}

async function cmdAlerts(): Promise<string> {
  const db = createHermezDb();
  const rows = await db
    .select()
    .from(hermezAlertLog)
    .where(eq(hermezAlertLog.status, "open"))
    .orderBy(desc(hermezAlertLog.createdAt))
    .limit(10);
  if (!rows.length) return "Tidak ada alert open. Semua bersih.";
  const lines = rows.map(
    (a, i) => `${i + 1}. [${String(a.severity).toUpperCase()}] ${a.alertType} — ${a.message.slice(0, 120)}`,
  );
  return [`ALERT OPEN (${rows.length})`, ...lines].join("\n");
}

const HELP = [
  "HERMEZ BOT",
  "/brief [YYYY-MM-DD] — daily brief",
  "/omzet [tgl] — revenue per outlet",
  "/hr [tgl] — kehadiran",
  "/alerts — alert open",
  "/sop <pertanyaan> — tanya AI",
  "/status — status bot",
  "Kirim teks bebas untuk dialog AI.",
].join("\n");

// ------------------------------------------------------------
// LLM dialog — owner-set credentials from the Integrasi UI.
// OpenAI-compatible chat-completions shape (openai, openrouter,
// deepseek, and any compatible base URL).
// ------------------------------------------------------------

async function askLlm(question: string, context: string): Promise<string> {
  const llm = await resolveLlmSettings();
  if (!llm.configured) {
    return "LLM belum dikonfigurasi. Set via Konfigurasi → Integrasi (LLM Provider / API Key / Model).";
  }
  const baseUrl = (llm.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = llm.model || "gpt-4o-mini";
  const sys = [
    "Kamu Hermez, asisten AI command center YKP (grup F&B).",
    "Jawab singkat, langsung, Bahasa Indonesia, pakai data konteks kalau relevan.",
    "Jangan mengarang angka. Kalau data tidak ada, bilang tidak ada.",
    "",
    "KONTEKS DATA HARI INI:",
    context,
  ].join("\n");
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${llm.apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: question },
        ],
        max_tokens: 700,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return `LLM error: ${json.error?.message ?? `HTTP ${res.status}`}`;
    return text;
  } catch (e) {
    return `LLM gagal: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Compact data context for the LLM (today's HR + finance + alerts). */
async function buildContext(): Promise<string> {
  const date = todayWib();
  try {
    const [hr, fin, alerts] = await Promise.all([
      createHrDb()
        .select({ outlet: hrDailySummary.outlet, present: hrDailySummary.staffPresent, late: hrDailySummary.staffLate, absent: hrDailySummary.staffAbsent, total: hrDailySummary.totalStaff })
        .from(hrDailySummary)
        .where(eq(hrDailySummary.date, new Date(date)))
        .catch(() => [] as { outlet: string; present: number; late: number; absent: number; total: number }[]),
      createFinanceDb()
        .select({ outlet: finDailySummary.outlet, revenue: finDailySummary.revenue, expense: finDailySummary.expense })
        .from(finDailySummary)
        .where(eq(finDailySummary.date, new Date(date)))
        .catch(() => [] as { outlet: string; revenue: number; expense: number }[]),
      createHermezDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(hermezAlertLog)
        .where(eq(hermezAlertLog.status, "open"))
        .catch(() => [{ count: 0 }]),
    ]);
    const parts: string[] = [`Tanggal: ${date}`];
    if (fin.length) {
      parts.push(`Omzet total: ${fmtIdr(fin.reduce((a, r) => a + (r.revenue ?? 0), 0))} dari ${fin.length} outlet`);
      parts.push(fin.map((r) => `  ${r.outlet}: ${fmtIdr(r.revenue ?? 0)}`).join("\n"));
    } else parts.push("Omzet: tidak ada data hari ini");
    if (hr.length) {
      parts.push(`Kehadiran: ${hr.reduce((a, r) => a + (r.present ?? 0), 0)}/${hr.reduce((a, r) => a + (r.total ?? 0), 0)} hadir, ${hr.reduce((a, r) => a + (r.late ?? 0), 0)} telat, ${hr.reduce((a, r) => a + (r.absent ?? 0), 0)} absen`);
    } else parts.push("HR: tidak ada data hari ini");
    parts.push(`Alert open: ${alerts[0]?.count ?? 0}`);
    return parts.join("\n");
  } catch {
    return "(konteks data tidak tersedia)";
  }
}

// ------------------------------------------------------------
// Update dispatcher
// ------------------------------------------------------------

async function handleMessage(token: string, msg: TgMessage, allowedChat: string): Promise<void> {
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  if (!text) return;

  if (!isAllowedChat(chatId, allowedChat)) {
    await sendTelegramMessage(token, chatId, "Maaf, chat ini tidak terdaftar sebagai owner Hermez. Set telegram_chat_id di Konfigurasi → Integrasi.");
    return;
  }

  state.messagesHandled += 1;
  const [rawCmd, ...rest] = text.split(/\s+/);
  const cmd = (rawCmd ?? "").toLowerCase().replace(/@\w+$/, "");
  const args = rest.join(" ");

  let reply: string;
  try {
    switch (cmd) {
      case "/start":
      case "/help":
        reply = HELP;
        break;
      case "/status":
        reply = [
          "HERMEZ BOT STATUS",
          `Mode: polling`,
          `Started: ${state.startedAt ?? "-"}`,
          `Messages handled: ${state.messagesHandled}`,
          `Last update id: ${state.lastUpdateId}`,
        ].join("\n");
        break;
      case "/brief":
        reply = await cmdBrief(args);
        break;
      case "/omzet":
        reply = await cmdOmzet(args);
        break;
      case "/hr":
        reply = await cmdHr(args);
        break;
      case "/alerts":
        reply = await cmdAlerts();
        break;
      case "/sop": {
        if (!args) { reply = "Format: /sop <pertanyaan>"; break; }
        reply = await askLlm(args, await buildContext());
        break;
      }
      default:
        // Free-text → AI dialog with live context.
        reply = await askLlm(text, await buildContext());
    }
  } catch (e) {
    reply = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
  await sendTelegramMessage(token, chatId, reply.slice(0, 4096));
}

// ------------------------------------------------------------
// Polling loop — singleton per process.
// ------------------------------------------------------------

let pollAbort: AbortController | null = null;

export async function startTelegramBot(): Promise<{ started: boolean; reason?: string }> {
  if (state.running) return { started: false, reason: "already_running" };
  const { token, chatId } = await resolveTelegramCredentials();
  if (!token || !chatId) return { started: false, reason: "missing_token_or_chat_id" };

  state.running = true;
  state.mode = "polling";
  state.lastError = null;
  state.startedAt = new Date().toISOString();
  pollAbort = new AbortController();

  // Clear any webhook so getUpdates works.
  await tgCall(token, "deleteWebhook", { drop_pending_updates: false });

  void (async () => {
    while (state.running) {
      state.pollCycles += 1;
      const updates = await tgCall<TgUpdate[]>(token, "getUpdates", {
        offset: state.lastUpdateId + 1,
        timeout: 30,
        allowed_updates: ["message"],
      });
      if (!updates) {
        state.lastTgError = state.lastError;
        // transient error — back off, keep polling
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      state.lastTgError = null;
      state.updatesSeen += updates.length;
      for (const u of updates) {
        state.lastUpdateId = Math.max(state.lastUpdateId, u.update_id);
        if (u.message) {
          await handleMessage(token, u.message, chatId).catch((e) => {
            state.lastError = `handle: ${e instanceof Error ? e.message : String(e)}`;
          });
        }
      }
    }
  })();

  return { started: true };
}

export function stopTelegramBot(): { stopped: boolean } {
  state.running = false;
  state.mode = "stopped";
  pollAbort?.abort();
  return { stopped: true };
}
