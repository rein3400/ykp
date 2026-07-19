import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export async function POST(): Promise<NextResponse> {
  await clearSession();
  return NextResponse.json({ data: { ok: true } });
}
