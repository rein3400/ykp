import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
const secret = 'release-test-session-secret-32-characters';
function token(exp: unknown) {
 const h=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url');
 const b=Buffer.from(JSON.stringify({userId:'test',exp})).toString('base64url');
 return h+'.'+b+'.'+createHmac('sha256',secret).update(h+'.'+b).digest('base64url');
}
function request(cookie?: string, headers: Record<string,string>={}) {
 return new NextRequest('http://localhost/api/finance/summary',{headers:{...headers,...(cookie?{cookie:'ykp_finance_session='+cookie}:{})}});
}
afterEach(()=>vi.unstubAllEnvs());
describe('Finance middleware credentials',()=>{
 it('denies anonymous financial reads',async()=>expect((await middleware(request())).status).toBe(401));
 it.each([0,1,undefined,'99999999999'])('denies expired or invalid expiry %s',async exp=>{
  vi.stubEnv('SESSION_SECRET',secret);
  expect((await middleware(request(token(exp)))).status).toBe(401);
 });
 it('denies malformed base64 without throwing',async()=>{
  vi.stubEnv('SESSION_SECRET',secret);
  expect((await middleware(request('a.b.%'))).status).toBe(401);
 });
 it('accepts current signed session',async()=>{
  vi.stubEnv('SESSION_SECRET',secret);
  expect((await middleware(request(token(Math.floor(Date.now()/1000)+60)))).status).toBe(200);
 });
 it('accepts only configured bot credentials',async()=>{
  vi.stubEnv('TELEGRAM_BOT_SECRET','test-bot-secret');
  expect((await middleware(request(undefined,{'x-bot-secret':'wrong'}))).status).toBe(401);
  expect((await middleware(request(undefined,{'x-bot-secret':'test-bot-secret'}))).status).toBe(200);
 });
});
