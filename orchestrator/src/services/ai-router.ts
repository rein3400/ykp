import OpenAI from 'openai';
import { env } from '../config/env.js';
import { db, schema } from '../db/index.js';
import { nanoid } from 'nanoid';

export type TaskType =
  | 'sop' | 'trading_reasoning' | 'coding' | 'image' | 'general'
  | 'knowledge_cleanup' | 'knowledge_summary'
  | 'ict_mentor' | 'news_analyst' | 'risk_manager' | 'trade_auditor' | 'psychology_coach';
export type ModelId = 'gpt' | 'qwen' | 'gemini' | 'claude';

export interface AiRequest {
  taskType: TaskType;
  userMessage: string;
  context?: string;
  preferredModel?: ModelId;
  userId?: string;
}

export interface AiResponse {
  ok: boolean;
  modelUsed: ModelId;
  response: string;
  error?: string;
  tokensIn: number;
  tokensOut: number;
}

const TASK_MODEL_MAP: Record<TaskType, ModelId> = {
  sop: 'qwen',
  trading_reasoning: 'gpt',
  coding: 'gpt',
  image: 'gpt',
  general: 'gpt',
  knowledge_cleanup: 'qwen',
  knowledge_summary: 'qwen',
  ict_mentor: 'gpt',
  news_analyst: 'gpt',
  risk_manager: 'gpt',
  trade_auditor: 'gpt',
  psychology_coach: 'gpt'
};

export async function routeAi(req: AiRequest): Promise<AiResponse> {
  const preferred = req.preferredModel ?? TASK_MODEL_MAP[req.taskType] ?? 'gpt';
  const chain: ModelId[] = buildChain(preferred);
  let lastErr = '';
  for (const model of chain) {
    try {
      const r = await callProvider(model, req);
      await logAiCall(req, r);
      return r;
    } catch (err) {
      lastErr = (err as Error).message;
    }
  }
  const r: AiResponse = { ok: false, modelUsed: preferred, response: '', error: lastErr || 'all providers failed', tokensIn: 0, tokensOut: 0 };
  await logAiCall(req, r);
  return r;
}

function buildChain(preferred: ModelId): ModelId[] {
  const all: ModelId[] = ['gpt', 'qwen', 'gemini', 'claude'];
  const rest = all.filter((m) => m !== preferred);
  return [preferred, ...rest];
}

async function callProvider(model: ModelId, req: AiRequest): Promise<AiResponse> {
  switch (model) {
    case 'gpt':
      return callGpt(req);
    case 'qwen':
      return callQwen(req);
    default:
      // gemini/claude stubs -> fallback message
      return {
        ok: false,
        modelUsed: model,
        response: '',
        error: `${model} provider not configured yet`,
        tokensIn: 0,
        tokensOut: 0
      };
  }
}

async function callGpt(req: AiRequest): Promise<AiResponse> {
  if (!env.OPENAI_API_KEY) {
    return { ok: false, modelUsed: 'gpt', response: '', error: 'OPENAI_API_KEY not set', tokensIn: 0, tokensOut: 0 };
  }
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const sys = req.context ? `Context:\n${req.context}` : 'You are YKP AI Assistant, helpful and concise.';
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: req.userMessage }
    ],
    temperature: 0.4,
    max_tokens: 800
  });
  const choice = completion.choices[0];
  return {
    ok: true,
    modelUsed: 'gpt',
    response: choice?.message?.content ?? '',
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0
  };
}

function isOllamaCloud(): boolean {
  const url = env.OLLAMA_BASE_URL.toLowerCase();
  return url.includes('ollama.com') || url.includes('api.ollama.ai');
}

function ollamaHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.OLLAMA_API_KEY) {
    h.Authorization = `Bearer ${env.OLLAMA_API_KEY}`;
  }
  return h;
}

async function callQwen(req: AiRequest): Promise<AiResponse> {
  const model = env.LOCAL_AI_MODEL || 'qwen2.5:7b';
  const base = env.OLLAMA_BASE_URL;
  const sys = req.context ? `${req.context}\n\nQuestion: ${req.userMessage}` : req.userMessage;

  if (isOllamaCloud()) {
    // Ollama cloud endpoints use /api/chat (not /api/generate).
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: ollamaHeaders(),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are YKP AI Assistant, helpful and concise.' },
          { role: 'user', content: sys }
        ],
        stream: false,
        options: { temperature: 0.4, num_predict: 800 }
      })
    });
    if (!res.ok) {
      throw new Error(`Ollama cloud HTTP ${res.status}: ${await res.text()}`);
    }
    const json = await res.json() as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
    return {
      ok: true,
      modelUsed: 'qwen',
      response: json.message?.content ?? '',
      tokensIn: json.prompt_eval_count ?? 0,
      tokensOut: json.eval_count ?? 0
    };
  }

  // Local Ollama: legacy /api/generate endpoint.
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: ollamaHeaders(),
    body: JSON.stringify({
      model,
      prompt: sys,
      stream: false,
      options: { temperature: 0.4, num_predict: 800 }
    })
  });
  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json() as { response?: string; prompt_eval_count?: number; eval_count?: number };
  return {
    ok: true,
    modelUsed: 'qwen',
    response: json.response ?? '',
    tokensIn: json.prompt_eval_count ?? 0,
    tokensOut: json.eval_count ?? 0
  };
}

async function logAiCall(req: AiRequest, r: AiResponse): Promise<void> {
  try {
    await db.insert(schema.aiLogs).values({
      id: `AIL-${nanoid(12)}`,
      userId: req.userId ?? null,
      taskType: req.taskType,
      modelUsed: r.modelUsed,
      prompt: req.userMessage.slice(0, 4000),
      response: r.response.slice(0, 4000),
      error: r.error ?? '',
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      costUsd: '0'
    });
  } catch {
    // ignore log failure
  }
}