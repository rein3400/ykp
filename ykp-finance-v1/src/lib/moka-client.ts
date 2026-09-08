/**
 * Moka Open API client (read-only). Endpoints per api.mokapos.com spec v0.2:
 *   POST /oauth/token   — exchange code / refresh token / client-credentials probe
 *   GET  /v2/outlets/{id}/reports/sales_summary  (dates DD/MM/YYYY)
 *   GET  /v3/outlets/{id}/reports/item_sales
 * Secrets live only in env (MOKA_<KEY>_*); tokens live in app_settings (moka-sync).
 * This file never logs or embeds client secrets in thrown errors.
 */

export interface MokaOutletConfig {
  key: string;
  clientId: string;
  clientSecret: string;
  mokaOutletId: string;
}

export interface MokaToken {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

const DEFAULT_API_BASE = 'https://api.mokapos.com';

export function mokaApiBase(): string {
  return (process.env.MOKA_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
}

/**
 * Outlet registry from env: MOKA_OUTLETS=KEY1,KEY2 plus per-key
 * MOKA_<KEY>_CLIENT_ID / MOKA_<KEY>_CLIENT_SECRET / MOKA_<KEY>_OUTLET_ID.
 * Keys with incomplete config are reported in `incomplete` (per spec: explicit
 * per-outlet error, other outlets keep running).
 */
export function parseOutletKeys(env: NodeJS.ProcessEnv = process.env): {
  configured: MokaOutletConfig[];
  incomplete: { key: string; missing: string[] }[];
} {
  const keys = (env.MOKA_OUTLETS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const configured: MokaOutletConfig[] = [];
  const incomplete: { key: string; missing: string[] }[] = [];
  for (const key of keys) {
    const missing: string[] = [];
    const clientId = env[`MOKA_${key}_CLIENT_ID`] ?? '';
    const clientSecret = env[`MOKA_${key}_CLIENT_SECRET`] ?? '';
    const mokaOutletId = env[`MOKA_${key}_OUTLET_ID`] ?? '';
    if (!clientId) missing.push(`MOKA_${key}_CLIENT_ID`);
    if (!clientSecret) missing.push(`MOKA_${key}_CLIENT_SECRET`);
    if (!mokaOutletId) missing.push(`MOKA_${key}_OUTLET_ID`);
    if (missing.length > 0) incomplete.push({ key, missing });
    else configured.push({ key, clientId, clientSecret, mokaOutletId });
  }
  return { configured, incomplete };
}

/** Moka report dates are DD/MM/YYYY; internal storage is YYYY-MM-DD. */
export function mokaDateToIso(v: string | undefined | null): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((v ?? '').trim());
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec((v ?? '').trim());
  if (iso) return iso[0];
  return '';
}

export function isoToMokaDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function tokenNeedsRefresh(tok: { expires_at: number } | null | undefined, nowMs = Date.now()): boolean {
  if (!tok || !tok.expires_at) return true;
  // refresh 5 min before expiry
  return tok.expires_at - 5 * 60_000 <= nowMs;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>, cfg: MokaOutletConfig): Promise<TokenResponse> {
  const res = await fetch(`${mokaApiBase()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, client_id: cfg.clientId, client_secret: cfg.clientSecret }),
    signal: AbortSignal.timeout(30_000)
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) {
    const reason = json.error_description || json.error || `HTTP ${res.status}`;
    // Error text only — never the request body (contains secrets).
    throw new Error(`Moka token request failed: ${reason}`);
  }
  return json;
}

/** One-time setup: exchange the App Market authorization `code` for tokens. */
export async function exchangeAuthorizationCode(
  cfg: MokaOutletConfig,
  code: string,
  redirectUri?: string
): Promise<MokaToken> {
  const json = await tokenRequest(
    { grant_type: 'authorization_code', code, ...(redirectUri ? { redirect_uri: redirectUri } : {}) },
    cfg
  );
  return {
    access_token: json.access_token!,
    refresh_token: json.refresh_token ?? '',
    expires_at: Date.now() + (json.expires_in ?? 0) * 1000
  };
}

/** Spike helper: probe whether the merchant supports client_credentials. */
export async function tryClientCredentials(cfg: MokaOutletConfig): Promise<MokaToken> {
  const json = await tokenRequest({ grant_type: 'client_credentials', scope: 'report' }, cfg);
  return {
    access_token: json.access_token!,
    refresh_token: json.refresh_token ?? '',
    expires_at: Date.now() + (json.expires_in ?? 0) * 1000
  };
}

/** Exchange a refresh token for a fresh access token. Throws on rejection. */
export async function refreshAccessToken(cfg: MokaOutletConfig, refreshToken: string): Promise<MokaToken> {
  const json = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken }, cfg);
  return {
    access_token: json.access_token!,
    refresh_token: json.refresh_token ?? refreshToken,
    expires_at: Date.now() + (json.expires_in ?? 0) * 1000
  };
}

/** GET a Moka report endpoint with Bearer auth. Returns parsed JSON. */
export async function mokaGet(
  token: string,
  path: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${mokaApiBase()}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60_000)
  });
  if (!res.ok) {
    throw new Error(`Moka API ${path} failed: HTTP ${res.status}`);
  }
  return res.json();
}