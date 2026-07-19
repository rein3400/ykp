// ============================================================
// @ykp/engine — Integration settings (hermez_config backed)
// ------------------------------------------------------------
// Telegram bot token / owner chat id and LLM credentials can be
// managed by the owner via the Hermez UI (stored in hermez_config).
// These readers resolve DB value first, then fall back to env vars,
// so existing env-based deploys keep working until the owner sets
// values in the UI. Secret values are only read server-side.
// ============================================================

import { createHermezDb, hermezConfig } from "@ykp/schema";
import { inArray } from "drizzle-orm";

export const INTEGRATION_KEYS = {
  telegramBotToken: "telegram_bot_token",
  telegramChatId: "telegram_chat_id",
  llmProvider: "llm_provider",
  llmApiKey: "llm_api_key",
  llmModel: "llm_model",
  llmBaseUrl: "llm_base_url",
} as const;

/** Keys whose values must be masked in API responses (never echoed raw). */
export const SECRET_INTEGRATION_KEYS: ReadonlySet<string> = new Set([
  INTEGRATION_KEYS.telegramBotToken,
  INTEGRATION_KEYS.llmApiKey,
]);

const ALL_INTEGRATION_KEYS = Object.values(INTEGRATION_KEYS);

/**
 * Read integration config rows from hermez_config.
 * Returns a key → value map for known integration keys only.
 * Returns an empty map when the DB is unreachable (callers then
 * fall back to env vars — same behaviour as before this feature).
 */
export async function readIntegrationConfig(): Promise<Record<string, string>> {
  try {
    const db = createHermezDb();
    const rows = await db
      .select({ key: hermezConfig.key, value: hermezConfig.value })
      .from(hermezConfig)
      .where(inArray(hermezConfig.key, ALL_INTEGRATION_KEYS));
    const out: Record<string, string> = {};
    for (const r of rows) {
      if (r.value && r.value.trim().length > 0) out[r.key] = r.value;
    }
    return out;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[integrations] failed to read hermez_config:", e);
    }
    return {};
  }
}

export interface TelegramCredentials {
  token: string;
  chatId: string;
  /** Where the effective values came from: "db" when both set in UI. */
  source: "db" | "env" | "mixed" | "none";
}

/**
 * Resolve telegram credentials: hermez_config (UI) wins over env.
 * Env fallback order matches the pre-existing behaviour:
 *   HERMEZ_TELEGRAM_BOT_TOKEN > TELEGRAM_BOT_TOKEN
 *   OWNER_CHAT_ID > TELEGRAM_OWNER_CHAT_ID
 */
export async function resolveTelegramCredentials(): Promise<TelegramCredentials> {
  const cfg = await readIntegrationConfig();
  const envToken = process.env.HERMEZ_TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? "";
  const envChatId = process.env.OWNER_CHAT_ID ?? process.env.TELEGRAM_OWNER_CHAT_ID ?? "";
  const token = cfg[INTEGRATION_KEYS.telegramBotToken] ?? envToken;
  const chatId = cfg[INTEGRATION_KEYS.telegramChatId] ?? envChatId;
  const fromDb = Boolean(cfg[INTEGRATION_KEYS.telegramBotToken] && cfg[INTEGRATION_KEYS.telegramChatId]);
  const source = !token || !chatId ? "none" : fromDb ? "db" : cfg[INTEGRATION_KEYS.telegramBotToken] || cfg[INTEGRATION_KEYS.telegramChatId] ? "mixed" : "env";
  return { token, chatId, source };
}

export interface LlmSettings {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  configured: boolean;
}

/**
 * Resolve LLM settings: hermez_config (UI) wins over env.
 * provider defaults to "openai"; baseUrl optional (empty = provider default).
 */
export async function resolveLlmSettings(): Promise<LlmSettings> {
  const cfg = await readIntegrationConfig();
  const provider =
    cfg[INTEGRATION_KEYS.llmProvider] ?? process.env.LLM_PROVIDER ?? "openai";
  const apiKey =
    cfg[INTEGRATION_KEYS.llmApiKey] ??
    process.env.LLM_API_KEY ??
    process.env.OPENAI_API_KEY ??
    "";
  const model = cfg[INTEGRATION_KEYS.llmModel] ?? process.env.LLM_MODEL ?? "";
  const baseUrl = cfg[INTEGRATION_KEYS.llmBaseUrl] ?? process.env.LLM_BASE_URL ?? "";
  return { provider, apiKey, model, baseUrl, configured: Boolean(apiKey) };
}

/** Mask a secret for display: keep last 4 chars, e.g. "••••1234". */
export function maskSecret(value: string): string {
  if (!value) return "";
  const tail = value.slice(-4);
  return `••••${tail}`;
}
