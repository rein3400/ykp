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

async function embedOllama(text: string): Promise<EmbedResult> {
  const model = env.EMBED_FALLBACK_MODEL;
  const res = await fetch(`${env.OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
