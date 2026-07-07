import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface MemoryRecord {
  id: string;
  scope: string;
  key: string;
  value: string;
  updatedAt: Date;
}

export async function getMemory(scope: string, key: string): Promise<MemoryRecord | null> {
  const res = await db.select().from(schema.memory)
    .where(and(eq(schema.memory.scope, scope), eq(schema.memory.key, key))).limit(1);
  return res[0] ?? null;
}

export async function listMemory(scope: string): Promise<MemoryRecord[]> {
  return db.select().from(schema.memory).where(eq(schema.memory.scope, scope));
}

export async function upsertMemory(scope: string, key: string, value: string): Promise<MemoryRecord> {
  const existing = await getMemory(scope, key);
  if (existing) {
    await db.update(schema.memory).set({ value, updatedAt: new Date() }).where(eq(schema.memory.id, existing.id));
    return { ...existing, value, updatedAt: new Date() };
  }
  const id = `MEM-${nanoid(12)}`;
  await db.insert(schema.memory).values({ id, scope, key, value });
  return { id, scope, key, value, updatedAt: new Date() };
}

export async function deleteMemory(id: string): Promise<void> {
  await db.delete(schema.memory).where(eq(schema.memory.id, id));
}