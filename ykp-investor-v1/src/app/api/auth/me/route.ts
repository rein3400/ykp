import { getSession } from '@/lib/session';
import { ok, unauthorized, handler } from '@/lib/http';
export const GET = handler(async () => { const s = await getSession(); if (!s) return unauthorized(); return ok(s); });