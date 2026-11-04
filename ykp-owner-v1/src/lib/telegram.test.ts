import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendOwnerDailyBrief } from './telegram';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('Owner Telegram delivery',()=>{
 it('supports shared chat configuration and sends long source text without HTML parsing',async()=>{
  vi.stubEnv('TELEGRAM_BOT_TOKEN','test-token');vi.stubEnv('TELEGRAM_BOT_CHAT_ID','');vi.stubEnv('TELEGRAM_CHAT_ID','123456');
  const fetcher=vi.fn(async()=>({ok:true,json:async()=>({ok:true,result:{message_id:1}})}));vi.stubGlobal('fetch',fetcher);
  const text=('<stok> & catatan\n').repeat(500);
  const result=await sendOwnerDailyBrief({date:'2026-11-05',text});
  expect(result.status).toBe('SENT');expect(fetcher.mock.calls.length).toBeGreaterThan(1);
  const bodies=fetcher.mock.calls.map(call=>JSON.parse((call as unknown as [string,RequestInit])[1].body as string));
  expect(bodies.every(b=>b.chat_id==='123456'&&!b.parse_mode&&b.text.length<=3500)).toBe(true);
  expect(bodies.map(b=>b.text).join('')).toBe(text);
 });
});
