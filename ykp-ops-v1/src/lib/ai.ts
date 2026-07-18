/**
 * Minimal AI provider wrapper for ykp-ops-v1.
 * Supports OpenAI (primary) and Ollama (fallback).
 * Every call is bounded: no streaming, max 10s timeout, graceful degradation.
 */

export type AiProvider = 'openai' | 'ollama';

export interface AiMessage {
  role: 'system' | 'user';
  content: string;
}

export interface AiOptions {
  temperature?: number;
  maxTokens?: number;
  system?: string;
  timeoutMs?: number;
}

function env(key: string): string | undefined {
  return process.env[key];
}

function getProvider(): AiProvider {
  const p = env('AI_PROVIDER');
  if (p === 'ollama') return 'ollama';
  return 'openai';
}

function getModel(): string {
  return (
    env('AI_MODEL') ?? (getProvider() === 'ollama' ? env('OLLAMA_MODEL') : 'gpt-4o-mini') ?? 'gpt-4o-mini'
  );
}

function getTemperature(): number {
  const t = env('AI_TEMPERATURE');
  if (t) {
    const n = Number(t);
    if (!Number.isNaN(n)) return n;
  }
  return 0.4;
}

async function callOpenAI(messages: AiMessage[], options: AiOptions): Promise<string> {
  const apiKey = env('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages,
      temperature: options.temperature ?? getTemperature(),
      max_tokens: options.maxTokens ?? 800,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`OpenAI HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (json.error?.message) {
    throw new Error(`OpenAI error: ${json.error.message}`);
  }
  const content = json.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    throw new Error('OpenAI returned empty content');
  }
  return content;
}

async function callOllama(messages: AiMessage[], options: AiOptions): Promise<string> {
  const baseUrl = (env('OLLAMA_BASE_URL') ?? 'http://localhost:11434').replace(/\/$/, '');
  const model = env('OLLAMA_MODEL') ?? getModel();
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? getTemperature(),
        num_predict: options.maxTokens ?? 800,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`Ollama HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { message?: { content?: string } };
  const content = json.message?.content?.trim() ?? '';
  if (!content) {
    throw new Error('Ollama returned empty content');
  }
  return content;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

/**
 * Generate a single text completion from the configured AI provider.
 * Falls back to Ollama if OpenAI is configured as provider but fails, and vice versa.
 */
export async function generateText(prompt: string, options: AiOptions = {}): Promise<string> {
  const messages: AiMessage[] = [];
  if (options.system) {
    messages.push({ role: 'system', content: options.system });
  }
  messages.push({ role: 'user', content: prompt });
  const timeout = options.timeoutMs ?? 10_000;
  const provider = getProvider();
  try {
    if (provider === 'ollama') {
      return await withTimeout(callOllama(messages, options), timeout);
    }
    return await withTimeout(callOpenAI(messages, options), timeout);
  } catch (primaryError) {
    const fallback: AiProvider = provider === 'openai' ? 'ollama' : 'openai';
    const fallbackAvailable =
      (fallback === 'openai' && env('OPENAI_API_KEY')) ||
      (fallback === 'ollama' && env('OLLAMA_BASE_URL'));
    if (!fallbackAvailable) {
      throw primaryError;
    }
    try {
      if (fallback === 'ollama') {
        return await withTimeout(callOllama(messages, options), timeout);
      }
      return await withTimeout(callOpenAI(messages, options), timeout);
    } catch (fallbackError) {
      throw new Error(
        `AI failed (${provider} and ${fallback}): ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
      );
    }
  }
}

/**
 * Generate structured JSON from the AI provider.
 * Prompt should include the expected JSON schema and a "Return only JSON" instruction.
 */
export async function generateJson<T>(prompt: string, options: AiOptions = {}): Promise<T> {
  const text = await generateText(prompt, options);
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned) as T;
}

/**
 * Health check for AI configuration.
 */
export function aiHealth(): {
  provider: AiProvider;
  configured: boolean;
  model: string;
  hasFallback: boolean;
} {
  const provider = getProvider();
  const configured =
    (provider === 'openai' && !!env('OPENAI_API_KEY')) ||
    (provider === 'ollama' && !!env('OLLAMA_BASE_URL'));
  const hasFallback =
    (provider === 'openai' && !!env('OLLAMA_BASE_URL')) ||
    (provider === 'ollama' && !!env('OPENAI_API_KEY'));
  return { provider, configured, model: getModel(), hasFallback };
}
