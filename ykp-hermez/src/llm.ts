/**
 * Ollama Cloud chat-completions client (OpenAI-compatible), tool-use loop
 * support. Model + key from env. Throws on HTTP error; caller (brain)
 * decides retries.
 *
 * deepseek-v4-flash is a reasoning model: it returns a `reasoning` field
 * (chain of thought) alongside the final `content`. We keep only `content`
 * and `tool_calls` — reasoning is never sent back to the user.
 */
import { CONFIG } from './config.js';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
}

export async function chat(
  messages: ChatMessage[],
  tools?: ToolSpec[],
  model: string = CONFIG.model
): Promise<ChatResult> {
  if (!CONFIG.llmApiKey) throw new Error('LLM_API_KEY not set');
  const res = await fetch(`${CONFIG.llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONFIG.llmApiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {})
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    error?: { message?: string };
  };
  if (json.error) throw new Error(`LLM: ${json.error.message ?? 'unknown error'}`);
  const msg = json.choices?.[0]?.message;
  if (!msg) throw new Error('LLM: empty response');
  return { content: msg.content ?? '', toolCalls: msg.tool_calls ?? [] };
}
