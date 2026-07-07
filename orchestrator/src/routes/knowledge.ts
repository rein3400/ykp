import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ragQuery } from '../modules/knowledge-search.js';
import { ingestText, ingestYouTube } from '../modules/knowledge-ingest.js';
import { KNOWLEDGE_CATEGORIES } from '../config/constants.js';
import { env } from '../config/env.js';

const ingestBody = z.object({
  text: z.string().optional(),
  youtubeUrl: z.string().url().optional(),
  category: z.string().min(1),
  title: z.string().optional()
});

const searchBody = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(20).default(5)
});

export default async function knowledgeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/knowledge/categories', async () => ({
    categories: KNOWLEDGE_CATEGORIES,
    root: env.KNOWLEDGE_ROOT
  }));

  app.post('/knowledge/search', async (req, reply) => {
    const parsed = searchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    const rag = await ragQuery(parsed.data.query, parsed.data.k);
    return { query: rag.query, hits: rag.hits };
  });

  app.post('/knowledge/ingest', async (req, reply) => {
    const parsed = ingestBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    if (!parsed.data.text && !parsed.data.youtubeUrl) {
      return reply.status(400).send({ error: 'either text or youtubeUrl required' });
    }
    try {
      if (parsed.data.youtubeUrl) {
        const res = await ingestYouTube(parsed.data.youtubeUrl, {
          category: parsed.data.category,
          title: parsed.data.title
        });
        return res;
      }
      const res = await ingestText(parsed.data.text ?? '', {
        category: parsed.data.category,
        title: parsed.data.title
      });
      return res;
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}