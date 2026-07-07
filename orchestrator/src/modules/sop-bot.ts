import { db, schema } from '../db/index.js';
import { ilike, or } from 'drizzle-orm';
import { routeAi } from '../services/ai-router.js';
import { logger } from '../services/logger.js';
import { ragQuery } from './knowledge-search.js';

export async function handleSop(query: string): Promise<string> {
  if (!query) {
    return 'Cara pakai: /sop <kata kunci>. Contoh: /sop komplain makanan terlambat';
  }

  // RAG-first: search Hermes knowledge base
  try {
    const rag = await ragQuery(query, 5);
    if (rag.hits.length > 0) {
      const ai = await routeAi({
        taskType: 'sop',
        userMessage: `Buat jawaban singkat dan praktis (maks 8 poin) untuk pertanyaan: "${query ?? ''}" berdasarkan konteks berikut.`,
        context: rag.context,
        preferredModel: 'qwen'
      });
      if (ai.ok && ai.response) {
        return ai.response.trim();
      }
      return `Konteks ditemukan tapi AI sedang tidak tersedia.\n\n${rag.hits[0]?.payload?.content ?? ''}`;
    }
  } catch (err) {
    logger.warn({ err, query }, 'rag sop search failed, falling back to ilike');
  }

  // Fallback to legacy ilike SQL search over sop_documents
  const terms = query.split(/\s+/).filter((t) => t.length > 2);
  const conditions = terms.map((t) =>
    or(ilike(schema.sopDocuments.title, `%${t}%`), ilike(schema.sopDocuments.content, `%${t}%`))
  );
  const validConditions = conditions.filter((c): c is NonNullable<typeof c> => Boolean(c));
  let docs: (typeof schema.sopDocuments.$inferSelect)[] = [];
  try {
    docs = validConditions.length
      ? await db.select().from(schema.sopDocuments).where(or(...validConditions)).limit(3)
      : [];
  } catch (err) {
    logger.error({ err }, 'sop ilike search failed');
  }
  if (docs.length === 0) {
    return `SOP untuk "${query}" belum tersedia. Pertanyaan dicatat untuk evaluasi.`;
  }
  const context = docs.map((d) => `### ${d.title}\n${d.content}`).join('\n\n');
  const ai = await routeAi({
    taskType: 'sop',
    userMessage: `Buat jawaban singkat dan praktis (maks 8 poin) untuk pertanyaan: "${query ?? ''}" berdasarkan SOP berikut.`,
    context,
    preferredModel: 'qwen'
  });
  if (!ai.ok || !ai.response) {
    return `SOP ditemukan tapi AI sedang tidak tersedia.\n\n${docs[0]?.content ?? ''}`;
  }
  return ai.response.trim();
}
