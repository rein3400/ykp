import { describe, it, expect } from 'vitest';
import { buildMimeMessage, encodeHeader, smtpConfig } from './smtp';
import { Buffer } from 'node:buffer';

describe('smtp lib (MOM 1 Sep 2026 item 5)', () => {
  it('smtpConfig returns null when env is missing', () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    expect(smtpConfig()).toBeNull();
  });

  it('smtpConfig reads host/port/user/from', () => {
    process.env.SMTP_HOST = 'mail.example.id';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'hr@example.id';
    process.env.SMTP_PASS = 'secret-pass';
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_SECURE;
    const cfg = smtpConfig();
    expect(cfg).toMatchObject({ host: 'mail.example.id', port: 587, secure: false, user: 'hr@example.id', from: 'hr@example.id' });
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it('encodeHeader leaves ASCII alone, encodes non-ASCII', () => {
    expect(encodeHeader('Slip Gaji')).toBe('Slip Gaji');
    expect(encodeHeader('Slip Gaji — Budi')).toMatch(/^\=\?UTF-8\?B\?.+\?\=$/);
  });

  it('buildMimeMessage emits multipart with HTML + attachment', () => {
    const raw = buildMimeMessage({
      from: 'hr@example.id',
      to: 'budi@example.id',
      subject: 'Slip Gaji 2026-09',
      htmlBody: '<p>Halo</p>',
      attachments: [{ filename: 'slip-1.html', contentType: 'text/html', content: Buffer.from('<p>Halo</p>') }],
      boundary: 'TESTBOUND',
      date: 'Mon, 01 Sep 2026 00:00:00 GMT',
      messageId: '<test@ykp-hr>'
    });
    expect(raw).toContain('Content-Type: multipart/mixed; boundary="TESTBOUND"');
    expect(raw).toContain('Content-Type: text/html; charset=UTF-8');
    expect(raw).toContain('filename="slip-1.html"');
    expect(raw).toContain(Buffer.from('<p>Halo</p>').toString('base64').slice(0, 12));
    expect(raw).toContain('Message-ID: <test@ykp-hr>');
    expect(raw.trimEnd().endsWith('--TESTBOUND--')).toBe(true);
  });
});
