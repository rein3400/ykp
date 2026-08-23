/**
 * Approval button crypto + dispatch (Fase 4).
 *
 * Covers: sign/verify roundtrip, wrong-module rejection, tamper (id, ts, sig),
 * expiry window, 64-byte callback_data cap, and processCallbackUpdate authz —
 * unlinked presser must be refused without any relay call.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

beforeAll(() => {
  process.env.TELEGRAM_MANAGEMENT_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_BOT_SECRET = 'test-secret-1234567890';
});

import {
  signApprovalData, verifyCallbackData, detectAndVerify,
  CALLBACK_MAX_AGE_MS, setDecisionBaseUrl
} from '../src/approval.js';

const NOW = Date.now();
const NOW_SEC = Math.floor(NOW / 1000);

describe('signApprovalData / verifyCallbackData', () => {
  it('roundtrips a signed approve payload', () => {
    const data = signApprovalData('a.', 'EXP-1', NOW_SEC, 'finance')!;
    expect(data).toMatch(/^a\.5:EXP-1\.\d{10}\.[0-9a-f]{32}$/);
    const parsed = verifyCallbackData(data, 'finance', NOW);
    expect(parsed).toEqual({ action: 'approve', recordId: 'EXP-1', issuedAtMs: NOW_SEC * 1000 });
  });

  it('roundtrips reject with distinct prefix', () => {
    const data = signApprovalData('r.', 'EXP-1', NOW_SEC, 'finance')!;
    const parsed = verifyCallbackData(data, 'finance');
    expect(parsed?.action).toBe('reject');
    // approve/reject MACs differ → cross-verify must fail
    expect(verifyCallbackData(data.replace(/^r\./, 'a.'), 'finance')).toBeNull();
  });

  it('verifies only against the module that signed', () => {
    const data = signApprovalData('a.', 'SUP-9', NOW_SEC, 'warehouse')!;
    expect(verifyCallbackData(data, 'finance')).toBeNull();
    expect(verifyCallbackData(data, 'warehouse')).not.toBeNull();
  });

  it('detects the source module automatically', () => {
    const data = signApprovalData('a.', 'INV-2', NOW_SEC, 'investor')!;
    const det = detectAndVerify(data)!;
    expect(det.module).toBe('investor');
    expect(det.parsed.recordId).toBe('INV-2');
  });

  it('rejects tampered record id / timestamp / signature / length tag', () => {
    const base = signApprovalData('a.', 'EXP-100', NOW_SEC, 'finance')!;
    // swap id inside same-length envelope
    expect(verifyCallbackData(base.replace('EXP-100', 'EXP-101'), 'finance')).toBeNull();
    // shift timestamp
    expect(verifyCallbackData(base.replace(/\.(17\d{8})\./, '.1700000001.'), 'finance')).toBeNull();
    // flip last sig char
    const flipped = base.slice(0, -1) + (base.endsWith('0') ? '1' : '0');
    expect(verifyCallbackData(flipped, 'finance')).toBeNull();
    // wrong embedded length
    expect(verifyCallbackData(base.replace(/^a\.7:/, 'a.6:'), 'finance')).toBeNull();
  });

  it('enforces the 24h expiry and rejects future timestamps > 1min', () => {
    const old = signApprovalData('a.', 'EXP-1', Math.floor((NOW - CALLBACK_MAX_AGE_MS - 5000) / 1000), 'finance')!;
    expect(verifyCallbackData(old, 'finance', NOW)).toBeNull();

    const edge = signApprovalData('a.', 'EXP-1', Math.floor((NOW - CALLBACK_MAX_AGE_MS + 60_000) / 1000), 'finance')!;
    expect(verifyCallbackData(edge, 'finance', NOW)).not.toBeNull();

    const future = signApprovalData('a.', 'EXP-1', Math.floor((NOW + 10 * 60_000) / 1000), 'finance')!;
    expect(verifyCallbackData(future, 'finance', NOW)).toBeNull();
  });

  it('returns null over the 64-byte Telegram callback_data limit', () => {
    const longId = 'EXP-' + 'A'.repeat(60);
    expect(signApprovalData('a.', longId, NOW_SEC, 'finance')).toBeNull();
  });
});

describe('processCallbackUpdate authz', () => {
  it('refuses an unlinked presser without relaying anything', async () => {
    setDecisionBaseUrl('testmod', 'http://127.0.0.1:1');
    const { processCallbackUpdate } = await import('../src/approval.js');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));
    const answerSpy = vi.fn();
    const editSpy = vi.fn();
    const sendSpy = vi.fn();
    const mod = await import('../src/approval.js');
    // Stub telegram side-effects via module internals: we assert via fetch not called.
    void answerSpy; void editSpy; void sendSpy;

    const data = signApprovalData('a.', 'EXP-1', NOW_SEC, 'testmod')!;
    await processCallbackUpdate({
      id: 'cbq-1',
      from: { id: 424242 }, // unknown chat id → resolveActor returns null (fetch mocked below)
      message: { message_id: 10, chat: { id: 424242 } },
      data
    });
    // Only the HR actor lookup fetch may happen; the decision relay must not.
    expect(fetchSpy).toHaveBeenCalled();
    const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('/api/internal/approval'))).toBe(false);
    fetchSpy.mockRestore();
    void mod;
  }, 20_000);
});
