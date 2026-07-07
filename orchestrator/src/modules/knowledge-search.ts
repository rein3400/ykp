import { embed } from '../services/embeddings.js';
import { searchSimilar, type SearchResult } from '../services/vector-db.js';
import { logger } from '../services/logger.js';

export interface RagResult {
  query: string;
  hits: SearchResult[];
  context: string;
}

/**
 * RAG query: embed query → vector search → return top-k chunks + assembled context.
 */
export async function ragQuery(query: string, k = 5): Promise<RagResult> {
  const emb = await embed(query);
  const hits = await searchSimilar(emb.vec, k);
  const context = hits.map((h, i) => `[${i + 1}] ${h.payload.title} (${h.payload.category})\n${h.payload.content}`).join('\n\n');
  logger.debug({ query, k, hits: hits.length }, 'rag query done');
  return { query, hits, context };
}

export function hasRagHits(r: RagResult): boolean {
  return r.hits.length > 0;
}