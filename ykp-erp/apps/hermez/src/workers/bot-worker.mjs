/**
 * Hermez Telegram dialog bot worker (standalone, plain Node — no @ykp/* deps).
 *
 * Single getUpdates consumer for the bot token. The web process never polls.
 * Data commands (/brief /omzet /hr /alerts) and the LLM context are fetched
 * from the web service's internal /api/hermez/bot-data endpoint (which owns
 * the DB), so this worker needs no workspace package resolution. LLM dialog
 * calls the owner-configured provider directly.
 *
 * Env:
 *   HERMEZ_BOT_SECRET        shared secret for /api/hermez/bot-data (required)
 *   HERMEZ_WEB_URL           web base URL (default http://127.0.0.1:PORT or :3004)
 *   TELEGRAM_BOT_TOKEN / HERMEZ_TELEGRAM_BOT_TOKEN   bot token (or hermez_config via web)
 *   OWNER_CHAT_ID / TELEGRAM_OWNER_CHAT_ID           owner chat/group id
 *   HERMEZ_BOT_ENABLED=true   REQUIRED to start (opt-in since 2026-07-19 —
 *                             ykp-hermez at repo root is the authoritative bot;
 *                             two getUpdates pollers on one token steal each
 *                             other's messages). Previously: HERMEZ_BOT_DISABLED.
 *
 * Note: telegram/LLM creds are read from env here. When the owner sets them
 * via the UI (hermez_config), the web service is authoritative; this worker
 * uses env as its local copy. Keep env in sync via Railway variables.
 */

const API = "https://api.telegram.org";
const WEB = (process.env.HERMEZ_WEB_URL || `http://127.0.0.1:${process.env.PORT || 3004}`).replace(/\/+$/, "");
const SECRET = process.env.HERMEZ_BOT_SECRET || "";
const TOKEN = process.env.HERMEZ_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.OWNER_CHAT_ID || process.env.TELEGRAM_OWNER_CHAT_ID || "";
// Allow the owner to chat from the group AND from a private DM with the bot.
// OWNER_CHAT_ID may be a single id or a comma-separated list
// (e.g. "-5437367893,5721500978"). OWNER_USER_IDS adds extra allowed ids.
const ALLOWED_CHATS = new Set(
  [...CHAT_ID.split(","), ...(process.env.OWNER_USER_IDS || "").split(",")]
    .map((s) => s.trim())
    .filter(Boolean),
);

const state = { lastUpdateId: 0, pollCycles: 0, updatesSeen: 0, messagesHandled: 0 };

async function tg(method, body) {
  try {
    const res = await fetch(`${API}/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(method === "getUpdates" ? 35_000 : 10_000),
    });
    const json = await res.json();
    if (!json.ok) { console.error(`[hermez-bot] ${method}: ${json.description}`); return null; }
    return json.result ?? null;
  } catch (e) {
    console.error(`[hermez-bot] ${method} error: ${e.message}`);
    return null;
  }
}

async function botData(cmd, date) {
  try {
    const u = `${WEB}/api/hermez/bot-data?cmd=${encodeURIComponent(cmd)}${date ? `&date=${date}` : ""}`;
    const res = await fetch(u, { headers: { "x-bot-secret": SECRET }, signal: AbortSignal.timeout(15_000) });
    const json = await res.json();
    return json?.data?.text ?? `(${cmd}: tidak ada data)`;
  } catch (e) {
    return `(${cmd} gagal: ${e.message})`;
  }
}

async function askLlm(question) {
  const provider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!apiKey) return "LLM belum dikonfigurasi. Set LLM_API_KEY (+ LLM_BASE_URL/LLM_MODEL) di env worker.";
  const context = await botData("context");
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
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, { role: "user", content: question }], max_tokens: 700, temperature: 0.3 }),
      signal: AbortSignal.timeout(45_000),
    });
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) return `LLM error: ${json?.error?.message ?? `HTTP ${res.status}`} (provider=${provider})`;
    return text;
  } catch (e) {
    return `LLM gagal: ${e.message}`;
  }
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

function dateParam(args) {
  const m = args.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : undefined;
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  if (!text) return;
  if (!ALLOWED_CHATS.has(String(chatId))) {
    await tg("sendMessage", { chat_id: chatId, text: "Maaf, chat ini tidak terdaftar sebagai owner Hermez." });
    return;
  }
  state.messagesHandled += 1;
  const [rawCmd, ...rest] = text.split(/\s+/);
  const cmd = (rawCmd || "").toLowerCase().replace(/@\w+$/, "");
  const args = rest.join(" ");
  let reply;
  try {
    switch (cmd) {
      case "/start":
      case "/help":
        reply = HELP; break;
      case "/status":
        reply = `HERMEZ BOT STATUS\nMode: polling (worker)\nPolls: ${state.pollCycles}\nUpdates: ${state.updatesSeen}\nHandled: ${state.messagesHandled}\nLast update id: ${state.lastUpdateId}`; break;
      case "/brief":
        reply = await botData("brief", dateParam(args)); break;
      case "/omzet":
        reply = await botData("omzet", dateParam(args)); break;
      case "/hr":
        reply = await botData("hr", dateParam(args)); break;
      case "/alerts":
        reply = await botData("alerts"); break;
      case "/sop":
        reply = args ? await askLlm(args) : "Format: /sop <pertanyaan>"; break;
      default:
        reply = await askLlm(text);
    }
  } catch (e) {
    reply = `Error: ${e.message}`;
  }
  await tg("sendMessage", { chat_id: chatId, text: String(reply).slice(0, 4096) });
}

async function main() {
  if (process.env.HERMEZ_BOT_ENABLED !== "true") {
    console.log("[hermez-bot] not started: ykp-hermez (repo root) is the authoritative bot worker.");
    console.log("[hermez-bot] set HERMEZ_BOT_ENABLED=true ONLY if you intentionally run this legacy worker instead — never both on one token.");
    return;
  }
  console.log(`[hermez-bot] boot web=${WEB} chat=${CHAT_ID || "(unset)"} token=${TOKEN ? "set" : "unset"} secret=${SECRET ? "set" : "unset"}`);
  if (!TOKEN || !CHAT_ID) { console.error("[hermez-bot] missing TELEGRAM_BOT_TOKEN or OWNER_CHAT_ID — retrying via watchdog"); process.exit(1); }
  if (!SECRET) { console.error("[hermez-bot] missing HERMEZ_BOT_SECRET — retrying via watchdog"); process.exit(1); }

  await tg("deleteWebhook", { drop_pending_updates: false });
  console.log(`[hermez-bot] polling started, web=${WEB} chat=${CHAT_ID}`);

  const keepalive = setInterval(() => {
    console.log(`[hermez-bot] alive polls=${state.pollCycles} updates=${state.updatesSeen} handled=${state.messagesHandled}`);
  }, 5 * 60 * 1000);
  keepalive.unref?.();

  while (true) {
    state.pollCycles += 1;
    const updates = await tg("getUpdates", { offset: state.lastUpdateId + 1, timeout: 30, allowed_updates: ["message"] });
    if (!updates) { await new Promise((r) => setTimeout(r, 3000)); continue; }
    state.updatesSeen += updates.length;
    for (const u of updates) {
      state.lastUpdateId = Math.max(state.lastUpdateId, u.update_id);
      if (u.message) {
        console.log(`[hermez-bot] msg chat=${u.message.chat.id} fromBot=${u.message.from?.is_bot} text=${(u.message.text || "").slice(0, 30)}`);
        await handleMessage(u.message).catch((e) => console.error(`[hermez-bot] handle: ${e.message}`));
      }
    }
  }
}

main().catch((e) => { console.error("[hermez-bot] fatal:", e); process.exit(1); });
