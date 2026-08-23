/**
 * Hermez notification gateway client.
 *
 * When USE_NOTIFY_GATEWAY=true and NOTIFY_GATEWAY_URL is set, broadcast-type
 * sends (daily brief, alerts to management roles) go through the Hermez
 * outbound gateway (POST /api/internal/send), which resolves recipients by
 * role from the users table and fans out via the MANAGEMENT bot. When the
 * gateway is disabled or unreachable, callers fall back to the legacy direct
 * sendTelegram path (employee/legacy bot + TELEGRAM_CHAT_ID).
 */
const GATEWAY_ENABLED = () =>
  (process.env.USE_NOTIFY_GATEWAY ?? '').trim() === 'true' &&
  Boolean((process.env.NOTIFY_GATEWAY_URL ?? '').trim());

export interface GatewaySendInput {
  /** Log label, e.g. daily_brief | ALERT. */
  message_type: string;
  source_module: string;
  /** Comma-separated role list; default "owner". */
  roles?: string;
  /** Optional brand scope filter. */
  brand_id?: string;
  message: string;
}

/**
 * Try the gateway. Returns true when the gateway accepted the request
 * (HTTP 202). Never throws — any failure resolves false so the caller can
 * use its legacy fallback.
 */
export async function sendViaGateway(input: GatewaySendInput): Promise<boolean> {
  if (!GATEWAY_ENABLED()) return false;
  try {
    const res = await fetch(`${(process.env.NOTIFY_GATEWAY_URL ?? '').replace(/\/$/, '')}/api/internal/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': (process.env.TELEGRAM_BOT_SECRET ?? '').trim()
      },
      body: JSON.stringify({
        message_type: input.message_type,
        source_module: input.source_module,
        roles: input.roles ?? 'owner',
        ...(input.brand_id ? { brand_id: input.brand_id } : {}),
        message: input.message
      }),
      signal: AbortSignal.timeout(5000)
    });
    return res.status === 202;
  } catch {
    return false;
  }
}
