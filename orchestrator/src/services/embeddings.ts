import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface EmbedResult {
  vec: number[];
  model: string;
  dim: number;
}

export async function embed(text: string): Promise<EmbedResult> {
  if (!text || !text.trim()) {
    throw new Error('embed: empty text');
  }
  // Truncate overly long inputs to avoid API errors
  const trimmed = text.length > 8000 ? text.slice(0, 8000) : text;

  if (env.EMBED_PROVIDER === 'openai') {
    return embedOpenAI(trimmed);
  }
  return embedOllama(trimmed);
}

async function embedOpenAI(text: string): Promise<EmbedResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const res = await client.embeddings.create({
    model: env.EMBED_MODEL,
    input: text
  });
  const vec = res.data[0]?.embedding;
  if (!vec) throw new Error('openai: empty embedding');
  logger.debug({ model: env.EMBED_MODEL, dim: vec.length }, 'embedded via openai');
  return { vec, model: env.EMBED_MODEL, dim: vec.length };
}

function isOllamaCloud(): boolean {
  const url = env.OLLAMA_BASE_URL.toLowerCase();
  return url.includes('ollama.com') || url.includes('api.ollama.ai');
}

async function embedOllama(text: string): Promise<EmbedResult> {
  const model = env.EMBED_FALLBACK_MODEL;
  const base = env.OLLAMA_BASE_URL;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.OLLAMA_API_KEY) {
    headers.Authorization = `Bearer ${env.OLLAMA_API_KEY}`;
  }

  if (isOllamaCloud()) {
    // Ollama cloud exposes OpenAI-compatible /v1/embeddings.
    const res = await fetch(`${base.replace(/\/$/, '')}/v1/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, input: text })
    });
    if (!res.ok) {
      throw new Error(`Ollama cloud embedding HTTP ${res.status}: ${await res.text()}`);
    }
    const json = await res.json() as { data?: { embedding?: number[] }[] };
    const vec = json.data?.[0]?.embedding;
    if (!vec) throw new Error('ollama cloud: empty embedding');
    logger.debug({ model, dim: vec.length }, 'embedded via ollama cloud');
    return { vec, model, dim: vec.length };
  }

  // Local Ollama: legacy /api/embeddings endpoint.
  const res = await fetch(`${base}/api/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, prompt: text })
  });
  if (!res.ok) {
    throw new Error(`Ollama embedding HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json() as { embedding?: number[] };
  const vec = json.embedding;
  if (!vec) throw new Error('ollama: empty embedding');
  logger.debug({ model, dim: vec.length }, 'embedded via ollama');
  return { vec, model, dim: vec.length };
}
