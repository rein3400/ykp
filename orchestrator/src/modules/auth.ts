import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { COMMAND_PERMISSIONS } from '../config/constants.js';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export async function getUserByTelegramId(telegramId: number): Promise<typeof schema.users.$inferSelect | undefined> {
  const res = await db.select().from(schema.users).where(eq(schema.users.telegramId, String(telegramId))).limit(1);
  return res[0];
}

export function canAccess(role: string, command: string): boolean {
  const allowed = COMMAND_PERMISSIONS[command] ?? COMMAND_PERMISSIONS['/help'];
  return (allowed ?? []).includes(role);
}

export async function ensureOwnerFromEnv(): Promise<void> {
  const ownerChatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (!ownerChatId) return;
  const existing = await getUserByTelegramId(Number(ownerChatId));
  if (existing) return;
  await db.insert(schema.users).values({
    id: `USR-OWNER-${ownerChatId}`,
    telegramId: ownerChatId,
    name: 'Owner (env)',
    role: 'owner',
    isActive: true
  });
}