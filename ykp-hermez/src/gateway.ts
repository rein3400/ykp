/**
 * Hermez outbound notification gateway.
 *
 * Single egress point for ALL module-app Telegram pushes (daily briefs,
 * alerts). Module apps POST here; the gateway resolves recipients by
 * role+scope from the HR users table (dynamic, no hardcoded TELEGRAM_CHAT_ID),
 * fans out via the management bot, and appends a delivery log row per send.
 *
 * Design (approved plan §Fase 2):
 * - node:http server on NOTIFY_GATEWAY_PORT (default 3020) — Hermez is a
 *   zero-dependency service, so no Fastify/Express.
 * - FIFO in-memory queue with retry (max 3 attempts, exponential backoff)
 *   so Telegram rate limits never block the caller's HTTP response.
 * - Auth: x-bot-secret shared secret (same as module read endpoints).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG } from './config.js';
import { sendMessage, type InlineKeyboard } from './telegram.js';
import { signApprovalData, CALLBACK_MAX_AGE_MS } from './approval.js';

export interface NotifyRequest {
  /** message_type for the delivery log (daily_brief | alert | approval ...). */
  message_type: string;
  source_module?: string;
  /** Comma-separated roles; default "owner". */
  roles?: string;
  /** Optional brand scope filter passed to the recipients endpoint. */
  brand_id?: string;
  /** Explicit chat id override — skips role resolution when set. */
  chat_ids?: string[];
  message: string;
  /**
   * Approval block (Fase 4). When present the gateway signs a callback_data
   * pair (approve/reject) keyed with TELEGRAM_BOT_SECRET and attaches an
   * inline keyboard; button presses are relayed back to
   * `${source_module}/api/internal/approval` by the Hermez callback handler.
   */
  approval?: {
    entity: string;
    record_id: string;
    title?: string;
    detail?: Record<string, string>;
    /** Decision target base URL, e.g. http://127.0.0.1:3003 (default: module port map). */
    callback_base_url?: string;
    /** Roles allowed to press the buttons (informational; enforcement is server-side). */
    allowed_roles?: string[];
    /** TTL in seconds (default 24h, max 7d). */
    ttl_seconds?: number;
  };
}

interface QueueItem extends NotifyRequest {
  attempts: number;
  nextAttemptAt: number;
}

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 5_000;
const QUEUE_DRAIN_MS = 500;

const queue: QueueItem[] = [];
let draining = false;

function gatewayPort(): number {
  return Number(process.env.NOTIFY_GATEWAY_PORT ?? '3020');
}

function gatewaySecret(): string {
  // Read lazily (not via CONFIG) so runtime env changes apply without rebuild;
  // same value in production since config.js loads .env into process.env.
  return (process.env.TELEGRAM_BOT_SECRET ?? '').trim();
}

/** Resolve recipient chat ids from the HR users table via telegram-recipients. */
async function resolveRecipients(req: NotifyRequest): Promise<number[]> {
  if (req.chat_ids && req.chat_ids.length > 0) {
    return req.chat_ids.map(Number).filter((n) => Number.isFinite(n));
  }
  const roles = (req.roles ?? 'owner').trim() || 'owner';
  const params = new URLSearchParams({ roles });
  if (req.brand_id) params.set('brand_id', req.brand_id);
  const url = `${CONFIG.modules.hr}/api/hr/telegram-recipients?${params.toString()}`;
  const res = await fetch(url, { headers: { 'x-bot-secret': gatewaySecret() } });
  if (!res.ok) throw new Error(`recipients resolve failed: HTTP ${res.status}`);
  const body = (await res.json()) as {
    data?: { recipients?: Array<{ telegram_id: string }> };
    recipients?: Array<{ telegram_id: string }>;
  };
  const list = body.data?.recipients ?? body.recipients ?? [];
  return list.map((r) => Number(r.telegram_id)).filter((n) => Number.isFinite(n));
}

async function logDelivery(entry: Record<string, unknown>): Promise<void> {
  try {
    await mkdir(CONFIG.dataDir, { recursive: true });
    await appendFile(
      join(CONFIG.dataDir, 'notify-gateway-log.ndjson'),
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'
    );
  } catch (e) {
    console.error('[gateway] log write failed:', e instanceof Error ? e.message : e);
  }
}

/** Default decision-target base URLs per source module (VPS loopback). */
const MODULE_BASE_URLS: Record<string, string> = {
  finance: 'http://127.0.0.1:3003',
  hr: 'http://127.0.0.1:3002',
  warehouse: 'http://127.0.0.1:3005',
  investor: 'http://127.0.0.1:3006',
  ops: 'http://127.0.0.1:3007'
};

function moduleBaseUrl(sourceModule: string, override?: string): string {
  return (override ?? '').trim() || MODULE_BASE_URLS[sourceModule] || `http://127.0.0.1:${process.env.PORT ?? '3000'}`;
}

/**
 * Build the approval message + inline keyboard for one queue item.
 * Returns null when the approval block is missing/invalid (logged as FAILED).
 */
export function buildApprovalMessage(item: NotifyRequest): { text: string; keyboard: InlineKeyboard; meta: Record<string, unknown> } | null {
  const ap = item.approval;
  if (!ap || typeof ap.entity !== 'string' || !ap.entity.trim()
    || typeof ap.record_id !== 'string' || !ap.record_id.trim()) return null;
  if (!item.source_module) return null;
  const ttlSec = Math.min(Math.max(Math.trunc(Number(ap.ttl_seconds) || CALLBACK_MAX_AGE_MS / 1000), 60), 7 * 24 * 3600);
  const now = Math.floor(Date.now() / 1000);
  // callback_data ≤64 bytes: prefix(2) + record_id + '.' + ts + '.' + hmac32hex
  const dataApprove = signApprovalData('a.', ap.record_id.trim(), now, item.source_module);
  const dataReject = signApprovalData('r.', ap.record_id.trim(), now, item.source_module);
  if (!dataApprove || !dataReject) return null;

  const detailLines = Object.entries(ap.detail ?? {})
    .map(([k, v]) => `${escapeHtmlLabel(k)}: <b>${escapeHtmlLabel(String(v))}</b>`)
    .join('\n');
  const title = escapeHtmlLabel(ap.title ?? `${ap.entity} ${ap.record_id}`);
  const text = [
    `<b>🔔 Approval Request</b>`,
    `${title}`,
    detailLines ? `\n${detailLines}` : '',
    `\nModul: ${escapeHtmlLabel(item.source_module)} | ID: <code>${escapeHtmlLabel(ap.record_id)}</code>`,
    `<i>Tombol kedaluwarsa ${Math.round(ttlSec / 3600)} jam setelah pesan ini dikirim.</i>`
  ].filter(Boolean).join('\n');

  const keyboard: InlineKeyboard = {
    inline_keyboard: [[
      { text: '✅ Setujui', callback_data: dataApprove },
      { text: '❌ Tolak', callback_data: dataReject }
    ]]
  };
  return {
    text,
    keyboard,
    meta: { entity: ap.entity, record_id: ap.record_id, ttl_seconds: ttlSec }
  };
}

/** Escape HTML-significant chars in dynamic label values. */
function escapeHtmlLabel(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Process one queue item. Recipient resolution failures and send failures
 * both retry up to MAX_ATTEMPTS; after that the item is dropped with a
 * FAILED log entry (never crashes the service).
 */
async function processItem(item: QueueItem): Promise<void> {
  item.attempts += 1;
  try {
    const chatIds = await resolveRecipients(item);
    if (chatIds.length === 0) {
      await logDelivery({
        status: 'NO_RECIPIENTS',
        message_type: item.message_type,
        source_module: item.source_module ?? '',
        roles: item.roles ?? 'owner',
        brand_id: item.brand_id ?? ''
      });
      return;
    }
    // Approval requests carry an inline keyboard signed with the bot secret.
    let replyMarkup: InlineKeyboard | undefined;
    if (item.approval) {
      const built = buildApprovalMessage(item);
      if (!built) {
        await logDelivery({
          status: 'FAILED',
          message_type: item.message_type,
          source_module: item.source_module ?? '',
          error: 'invalid approval block',
          attempts: item.attempts
        });
        return;
      }
      replyMarkup = built.keyboard;
    }
    let sent = 0;
    for (const chatId of chatIds) {
      try {
        // Module messages are HTML-formatted; sendMessage parses HTML with a
        // plain-text fallback per chunk.
        await sendMessage(chatId, item.message, replyMarkup);
        sent += 1;
      } catch (e) {
        console.error(`[gateway] send to ${chatId} failed:`, e instanceof Error ? e.message : e);
      }
    }
    await logDelivery({
      status: sent === chatIds.length ? 'SENT' : 'PARTIAL',
      message_type: item.message_type,
      source_module: item.source_module ?? '',
      roles: item.roles ?? 'owner',
      brand_id: item.brand_id ?? '',
      ...(item.approval ? { approval_record_id: item.approval.record_id, entity: item.approval.entity } : {}),
      recipients: chatIds.length,
      sent
    });
  } catch (e) {
    if (item.attempts < MAX_ATTEMPTS) {
      item.nextAttemptAt = Date.now() + RETRY_BASE_MS * 2 ** (item.attempts - 1);
      queue.push(item); // re-queue for retry
      console.warn(`[gateway] attempt ${item.attempts} failed, retrying later:`,
        e instanceof Error ? e.message : e);
      return;
    }
    await logDelivery({
      status: 'FAILED',
      message_type: item.message_type,
      source_module: item.source_module ?? '',
      roles: item.roles ?? 'owner',
      brand_id: item.brand_id ?? '',
      error: e instanceof Error ? e.message : String(e),
      attempts: item.attempts
    });
  }
}

export async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      const now = Date.now();
      const idx = queue.findIndex((i) => i.nextAttemptAt <= now);
      if (idx === -1) break;
      const [item] = queue.splice(idx, 1);
      await processItem(item);
    }
  } finally {
    draining = false;
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 256 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function respond(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Handle one gateway HTTP request. Returns true when handled. */
export async function handleGatewayRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/api/internal/send' && req.method === 'POST') {
    const provided = String(req.headers['x-bot-secret'] ?? '');
    if (!provided || provided !== gatewaySecret()) {
      respond(res, 401, { error: { code: 'unauthorized', message: 'Invalid bot secret' } });
      return;
    }
    let parsed: NotifyRequest;
    try {
      parsed = JSON.parse(await readBody(req)) as NotifyRequest;
    } catch {
      respond(res, 400, { error: { code: 'bad_request', message: 'invalid JSON' } });
      return;
    }
    if (!parsed || typeof parsed.message !== 'string' || !parsed.message.trim()) {
      respond(res, 400, { error: { code: 'bad_request', message: 'message required' } });
      return;
    }
    if (typeof parsed.message_type !== 'string' || !parsed.message_type.trim()) {
      respond(res, 400, { error: { code: 'bad_request', message: 'message_type required' } });
      return;
    }
    queue.push({
      ...parsed,
      message_type: parsed.message_type.trim(),
      attempts: 0,
      nextAttemptAt: Date.now()
    });
    void drain();
    respond(res, 202, { data: { queued: true, queue_depth: queue.length } });
    return;
  }

  if (url.pathname === '/api/internal/health' && req.method === 'GET') {
    respond(res, 200, { data: { ok: true, queue_depth: queue.length } });
    return;
  }

  respond(res, 404, { error: { code: 'not_found', message: 'Not found' } });
}

/** Start the gateway HTTP server + drain interval. No-op in DRY-RUN. */
export function startGateway(): void {
  if (DRY_RUN_GATEWAY()) {
    console.log('[gateway] disabled (no bot token configured)');
    return;
  }
  const server = createServer((req, res) => {
    void handleGatewayRequest(req, res).catch(() => respond(res, 500, { error: { code: 'internal', message: 'Internal error' } }));
  });
  server.listen(gatewayPort(), '127.0.0.1', () => {
    console.log(`[gateway] listening on 127.0.0.1:${gatewayPort()}`);
  });
  setInterval(() => void drain(), QUEUE_DRAIN_MS);
}

function DRY_RUN_GATEWAY(): boolean {
  return !CONFIG.botToken;
}
