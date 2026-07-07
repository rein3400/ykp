import fs from 'node:fs/promises';
import path from 'node:path';
import slugify from 'slugify';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import { routeAi } from '../services/ai-router.js';
import { ensureCollection, upsertChunk } from '../services/vector-db.js';
import { embed } from '../services/embeddings.js';
import { fetchTranscript } from '../services/youtube-transcript.js';
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_ROOT } from '../config/constants.js';
import { logger } from '../services/logger.js';

interface IngestOptions {
  category: string;
  title?: string;
  source?: string;
  url?: string;
  chunkSize?: number;
  overlap?: number;
}

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

function ensureKnowledgeCategory(c: string): string {
  return (KNOWLEDGE_CATEGORIES as readonly string[]).includes(c) ? c : 'ICT Foundation';
}

function chunkText(text: string, size: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + size);
    chunks.push(text.slice(i, end));
    if (end === text.length) break;
    i = end - overlap;
  }
  return chunks.filter((c) => c.trim().length > 50);
}

async function ensureKnowledgeDir(category: string): Promise<string> {
  const categorySafe = ensureKnowledgeCategory(category);
  const dir = path.join(KNOWLEDGE_ROOT, categorySafe);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function cleanupMarkdown(text: string, category: string, title: string): Promise<string> {
  const res = await routeAi({
    taskType: 'knowledge_cleanup',
    userMessage: `Rapikan catatan berikut untuk kategori "${category}" dengan judul "${title}". Jaga istilah ICT (FVG/IFVG/MSS/BOS/Order Block/Breaker/Mitigation/Silver Bullet/Judas Swing/SMT/DOL/MDO/TDO/Sweep/Liquidity/PD Array) tetap utuh. Output Markdown heading 1 = title, heading 2 = sub-topik, isi poin-poin.`,
    context: text.slice(0, 6000)
  });
  return res.ok && res.response ? res.response : text;
}

export async function ingestText(text: string, opts: IngestOptions): Promise<{ docId: string; chunks: number; path: string }> {
  const category = ensureKnowledgeCategory(opts.category);
  const title = opts.title ?? `Doc ${new Date().toISOString().slice(0, 10)}`;
  const source = opts.source ?? 'manual';

  await ensureCollection();

  const dir = await ensureKnowledgeDir(category);
  const slug = slugify(title, { lower: true, strict: true }) || nanoid(6);
  const filename = `${slug}.md`;
  const fullPath = path.join(dir, filename);

  const cleaned = await cleanupMarkdown(text, category, title);
  const header = `# ${title}\n\n_Kategori: ${category} · Sumber: ${source}_\n\n`;
  const fullDoc = header + cleaned;
  await fs.writeFile(fullPath, fullDoc, 'utf8');

  const docId = `KD-${nanoid(12)}`;
  const chunks = chunkText(fullDoc);

  await db.insert(schema.knowledgeDocuments).values({
    id: docId,
    category,
    source,
    title,
    url: opts.url ?? '',
    path: fullPath,
    status: 'indexed',
    chunks: chunks.length
  });

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i] ?? '';
    const emb = await embed(content);
    const chunkId = `KC-${nanoid(12)}`;
    await db.insert(schema.knowledgeChunks).values({
      id: chunkId,
      docId,
      chunkIdx: i,
      content,
      tokens: Math.ceil(content.length / 4)
    });
    await upsertChunk(`${docId}:${i}`, emb.vec, {
      docId,
      chunkIdx: i,
      category,
      source,
      title,
      url: opts.url
    }, content);
  }

  logger.info({ docId, category, chunks: chunks.length, path: fullPath }, 'knowledge ingested');
  return { docId, chunks: chunks.length, path: fullPath };
}

export async function ingestYouTube(url: string, opts: Omit<IngestOptions, 'source' | 'url'>): Promise<{ docId: string; chunks: number; path: string }> {
  const transcript = await fetchTranscript(url);
  return ingestText(transcript, { ...opts, source: 'youtube', url });
}