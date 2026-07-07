import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let client: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ url: env.QDRANT_URL });
  }
  return client;
}

export async function ensureCollection(name: string = env.QDRANT_COLLECTION, dim: number = env.EMBED_DIM): Promise<void> {
  const c = getClient();
  try {
    await c.getCollection(name);
    return;
  } catch {
    // not found -> create
  }
  await c.createCollection(name, {
    vectors: { size: dim, distance: 'Cosine' }
  });
  logger.info({ collection: name, dim }, 'qdrant collection created');
}

export interface ChunkMeta {
  docId: string;
  chunkIdx: number;
  category: string;
  source: string;
  title: string;
  url?: string;
}

export async function upsertChunk(pointId: string, vector: number[], meta: ChunkMeta, content: string): Promise<void> {
  const c = getClient();
  await c.upsert(env.QDRANT_COLLECTION, {
    wait: true,
    points: [
      {
        id: pointId,
        vector,
        payload: { ...meta, content }
      }
    ]
  });
}

export interface SearchResult {
  pointId: string;
  score: number;
  payload: ChunkMeta & { content: string };
}

export async function searchSimilar(vector: number[], k = 5): Promise<SearchResult[]> {
  const c = getClient();
  const res = await c.search(env.QDRANT_COLLECTION, {
    vector,
    limit: k,
    with_payload: true
  });
  return res.map((r) => {
    const p = r.payload as Record<string, unknown>;
    return {
      pointId: String(r.id),
      score: r.score,
      payload: {
        docId: String(p.docId ?? ''),
        chunkIdx: Number(p.chunkIdx ?? 0),
        category: String(p.category ?? ''),
        source: String(p.source ?? ''),
        title: String(p.title ?? ''),
        url: typeof p.url === 'string' ? p.url : undefined,
        content: String(p.content ?? '')
      }
    };
  });
}

export async function deleteByDocId(docId: string): Promise<void> {
  const c = getClient();
  try {
    await c.delete(env.QDRANT_COLLECTION, {
      wait: true,
      filter: { must: [{ key: 'docId', match: { value: docId } }] }
    });
  } catch (err) {
    logger.warn({ err, docId }, 'qdrant deleteByDocId failed');
  }
}

export async function pingQdrant(): Promise<boolean> {
  try {
    const c = getClient();
    // getCollections is a lightweight health probe
    await c.getCollections();
    return true;
  } catch {
    return false;
  }
}