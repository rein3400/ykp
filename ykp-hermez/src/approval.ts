/**
 * Telegram approval buttons (Fase 4).
 *
 * The Hermez notification gateway attaches an inline Setujui/Tolak keyboard to
 * approval requests. Button presses arrive as callback_query updates; this
 * module verifies the HMAC-signed callback_data, resolves the presser's RBAC
 * actor via the HR identity endpoints, and relays the decision to the source
 * module's POST /api/internal/approval endpoint — the module then enforces
 * its own FSM/thresholds/segregation rules server-side. Hermez never writes
 * business data itself.
 *
 * callback_data layout (≤64 bytes per Telegram limit):
 *   a.<record_id>.<unix_sec>.<hmac24hex>   → approve
 *   r.<record_id>.<unix_sec>.<hmac24hex>   → reject
 * Parsing splits on '.' from the right (ids never contain '.'); the id length
 * is mixed INTO the MAC input so ids of different lengths can never produce
 * colliding MAC inputs ("AB-1" vs "AB-12").
 * hmac = HMAC-SHA256(TELEGRAM_BOT_SECRET,
 *                    `${prefix}${len}:${id}.${ts}.${source_module}`)[..24 hex]
 * Truncated to 96 bits — sufficient here since the module re-validates every
 * decision server-side anyway.
 * The module name is not carried in callback_data (bytes are scarce); it is
 * recovered by trying each known module's MAC (detectAndVerify).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { CONFIG } from './config.js';
import { answerCallbackQuery, editMessageText, sendMessage } from './telegram.js';
import { resolveActor, isAllowedRole, type Actor } from './actor.js';

export const APPROVE_PREFIX = 'a.';
export const REJECT_PREFIX = 'r.';
/** Max age of a signed button pair (matches gateway default ttl_seconds). */
export const CALLBACK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  return (process.env.TELEGRAM_BOT_SECRET ?? '').trim();
}

/** Constant-time string compare (length-checked first). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Sign one callback_data value. Returns null when no secret is configured or
 * the payload would exceed Telegram's 64-byte callback_data limit.
 */
export function signApprovalData(
  prefix: 'a.' | 'r.',
  recordId: string,
  issuedAtSec: number,
  sourceModule: string
): string | null {
  const s = secret();
  if (!s) return null;
  const rid = recordId.trim();
  if (!rid || !Number.isFinite(issuedAtSec)) return null;
  const macInput = `${prefix}${rid.length}:${rid}.${issuedAtSec}.${sourceModule}`;
  const sig = createHmac('sha256', s).update(macInput).digest('hex').slice(0, 24);
  const data = `${prefix}${rid}.${issuedAtSec}.${sig}`;
  if (Buffer.byteLength(data, 'utf8') > 64) return null;
  return data;
}

export interface ParsedCallbackData {
  action: 'approve' | 'reject';
  recordId: string;
  issuedAtMs: number;
}

// prefix(2) + id + '.' + 10-digit ts + '.' + 24-hex sig; id may not contain '.'
const CALLBACK_RE = /^([ar])\.(.+)\.(\d{10})\.([0-9a-f]{24})$/;

/**
 * Verify structure + HMAC + age against ONE candidate source module.
 * Returns null on any failure (bad shape, wrong signature, expired).
 */
export function verifyCallbackData(
  raw: string,
  sourceModule: string,
  nowMs = Date.now()
): ParsedCallbackData | null {
  const m = raw.match(CALLBACK_RE);
  if (!m) return null;
  const [, flag, rid, tsStr, sig] = m;
  if (!rid) return null;
  const ts = Number(tsStr);
  const issuedAtMs = ts * 1000;
  // Reject expired AND far-future (clock skew > 1min).
  if (nowMs - issuedAtMs > CALLBACK_MAX_AGE_MS || issuedAtMs - nowMs > 60_000) return null;
  const prefix = flag === 'a' ? APPROVE_PREFIX : REJECT_PREFIX;
  const expected = createHmac('sha256', secret())
    .update(`${prefix}${rid.length}:${rid}.${ts}.${sourceModule}`)
    .digest('hex')
    .slice(0, 24);
  if (!safeEqual(sig, expected)) return null;
  return { action: flag === 'a' ? 'approve' : 'reject', recordId: rid, issuedAtMs };
}

// detectAndVerify iterates the union of built-in + overridden modules.
function knownModules(): string[] {
  return [...new Set([...Object.keys(MODULE_DECISION_URLS), ...moduleOverrides.keys()])];
}
export function detectAndVerify(raw: string, nowMs = Date.now()): { module: string; parsed: ParsedCallbackData } | null {
  for (const mod of knownModules()) {
    const parsed = verifyCallbackData(raw, mod, nowMs);
    if (parsed) return { module: mod, parsed };
  }
  return null;
}

// ── Relay to the source module ──────────────────────────────────────

const MODULE_DECISION_URLS: Record<string, string> = {
  finance: 'http://127.0.0.1:3003',
  hr: 'http://127.0.0.1:3002',
  warehouse: 'http://127.0.0.1:3005',
  investor: 'http://127.0.0.1:3006',
  ops: 'http://127.0.0.1:3007'
};

/** Test hook: override/insert a module decision base URL. */
const moduleOverrides = new Map<string, string>();
export function setDecisionBaseUrl(module: string, base: string): void {
  moduleOverrides.set(module, base);
}
function decisionBase(module: string): string | undefined {
  return moduleOverrides.get(module) ?? MODULE_DECISION_URLS[module];
}

export interface DecisionResult {
  ok: boolean;
  status: number;
  message?: string;
  /** New approval_status echoed by the module when available. */
  approval_status?: string;
}

async function relayDecision(
  sourceModule: string,
  recordId: string,
  action: 'approve' | 'reject',
  actor: Actor & { chatId: number },
  reason: string
): Promise<DecisionResult> {
  const base = decisionBase(sourceModule);
  if (!base) return { ok: false, status: 400, message: `unknown source module: ${sourceModule}` };
  try {
    const res = await fetch(`${base}/api/internal/approval`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': secret()
      },
      body: JSON.stringify({
        entity_hint: sourceModule,
        record_id: recordId,
        action,
        telegram_chat_id: String(actor.chatId),
        actor_user_id: actor.userId,
        reason
      }),
      signal: AbortSignal.timeout(10_000)
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: { approval_status?: string };
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, status: res.status, message: body.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, approval_status: body.data?.approval_status };
  } catch (e) {
    return { ok: false, status: 502, message: e instanceof Error ? e.message : String(e) };
  }
}

// ── Presser resolution (same policy as text messages) ───────────────

async function resolvePresser(chatId: number): Promise<(Actor & { chatId: number }) | null> {
  if (CONFIG.allowedIds.length > 0) {
    if (!CONFIG.allowedIds.includes(String(chatId))) return null;
    return { userId: `TG-${chatId}`, role: 'owner', brandId: '', outletId: '', employeeId: '', chatId };
  }
  if (CONFIG.ownerIds.includes(String(chatId))) {
    return { userId: `TG-${chatId}`, role: 'owner', brandId: '', outletId: '', employeeId: '', chatId };
  }
  const actor = await resolveActor(chatId);
  if (!actor || !isAllowedRole(actor.role)) return null;
  return { ...actor, chatId };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface CallbackLike {
  id: string;
  from?: { id: number };
  message?: { message_id: number; chat: { id: number } };
  data?: string;
}

/**
 * Handle one callback_query update (entry point from index.ts). Always answers
 * the query so the presser's spinner stops; on success edits the request
 * message to show who decided; on failure sends a follow-up explanation.
 */
export async function processCallbackUpdate(cb: CallbackLike): Promise<void> {
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  const presserTgId = cb.from?.id ?? chatId;
  if (!chatId || !messageId || presserTgId === undefined) {
    await answerCallbackQuery(cb.id, 'Pesan tidak valid.');
    return;
  }

  const detected = cb.data ? detectAndVerify(cb.data) : null;
  if (!detected) {
    await answerCallbackQuery(cb.id, 'Tombol tidak valid atau sudah kedaluwarsa.');
    return;
  }

  const actor = await resolvePresser(presserTgId);
  if (!actor) {
    await answerCallbackQuery(cb.id, 'Anda tidak memiliki izin untuk approval ini.');
    return;
  }

  const decision = await relayDecision(detected.module, detected.parsed.recordId, detected.parsed.action, actor, '');
  if (decision.ok) {
    const label = decision.approval_status ?? (detected.parsed.action === 'approve' ? 'APPROVED' : 'REJECTED');
    await editMessageText(chatId, messageId,
      `<b>${detected.parsed.action === 'approve' ? '✅' : '🚫'} ${escapeHtml(label)}</b>\n\n` +
      `Record <code>${escapeHtml(detected.parsed.recordId)}</code> (${escapeHtml(detected.module)}) diputuskan oleh ` +
      `<b>${escapeHtml(actor.userId)}</b> (${escapeHtml(actor.role)}).`);
    await answerCallbackQuery(cb.id, `Keputusan tersimpan: ${label}`);
  } else {
    await sendMessage(chatId,
      `⚠️ Gagal memproses keputusan untuk <code>${escapeHtml(detected.parsed.recordId)}</code>: ` +
      `${escapeHtml(decision.message ?? `HTTP ${decision.status}`)}. Coba lagi atau gunakan web app.`);
    await answerCallbackQuery(cb.id, 'Gagal — lihat pesan berikutnya.');
  }
}
