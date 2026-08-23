import { describe, it, expect, beforeAll } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGatewayRequest, drain } from '../src/gateway.js';

beforeAll(() => {
  process.env.TELEGRAM_MANAGEMENT_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_BOT_SECRET = 'test-secret-1234567890';
});

/** Minimal req double: EventEmitter so the handler's readBody() streams. */
function makeReq(url: string, method: string, headers: Record<string, string>, body: string) {
  const req = new EventEmitter() as unknown as IncomingMessage;
  Object.assign(req, { url, method, headers });
  queueMicrotask(() => {
    req.emit('data', Buffer.from(body));
    req.emit('end');
  });
  return req;
}

function makeRes(): ServerResponse & { statusCode: number; body: string } {
  const res = {
    statusCode: 0,
    body: '',
    writeHead(status: number) {
      this.statusCode = status;
      return this;
    },
    end(payload?: string) {
      this.body = payload ?? '';
    }
  } as unknown as ServerResponse & { statusCode: number; body: string };
  return res;
}

function post(body: unknown, secret = 'test-secret-1234567890') {
  return makeReq('/api/internal/send', 'POST', { 'x-bot-secret': secret }, JSON.stringify(body));
}

describe('gateway handleGatewayRequest', () => {
  it('401 without the shared secret', async () => {
    const res = makeRes();
    await handleGatewayRequest(post({ message: 'x', message_type: 'test' }, 'wrong'), res);
    expect(res.statusCode).toBe(401);
  });

  it('400 when message is missing', async () => {
    const res = makeRes();
    await handleGatewayRequest(post({ message_type: 'test' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('400 when message_type is missing', async () => {
    const res = makeRes();
    await handleGatewayRequest(post({ message: 'x' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('400 on invalid JSON', async () => {
    const res = makeRes();
    await handleGatewayRequest(
      makeReq('/api/internal/send', 'POST', { 'x-bot-secret': 'test-secret-1234567890' }, '{nope'),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  it('202 + queued on a valid send request', async () => {
    const res = makeRes();
    await handleGatewayRequest(post({ message: 'halo', message_type: 'test', chat_ids: ['1'] }), res);
    expect(res.statusCode, `body=${res.body}`).toBe(202);
    expect(res.body).toContain('"queued":true');
    await drain();
  });

  it('health endpoint reports queue depth', async () => {
    const res = makeRes();
    await handleGatewayRequest(makeReq('/api/internal/health', 'GET', {}, ''), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('queue_depth');
  });

  it('404 for unknown paths', async () => {
    const res = makeRes();
    await handleGatewayRequest(makeReq('/nope', 'GET', {}, ''), res);
    expect(res.statusCode).toBe(404);
  });
});
