/**
 * Minimal stdlib-only SMTP client (MOM 1 Sep 2026 item 5 — kirim slip gaji).
 *
 * No new dependencies: uses node:net / node:tls only. Supports implicit TLS
 * (port 465) and STARTTLS (port 587) with AUTH LOGIN. Sends one message with
 * an HTML body plus file attachments (slip gaji sebagai file, bukan teks).
 *
 * Env: SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE (true = port 465
 * implicit TLS), SMTP_USER, SMTP_PASS, SMTP_FROM (default SMTP_USER).
 * When SMTP_HOST/USER/PASS are missing, smtpConfig() returns null and
 * callers must answer 503 with a clear message (never crash, never fake).
 */
import net from 'node:net';
import tls from 'node:tls';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface Attachment {
  filename: string;
  contentType: string;
  /** raw bytes */
  content: Buffer;
}

/** Read SMTP config from env; null when sending is not configured. */
export function smtpConfig(): SmtpConfig | null {
  const host = (process.env.SMTP_HOST ?? '').trim();
  const user = (process.env.SMTP_USER ?? '').trim();
  const pass = (process.env.SMTP_PASS ?? '').trim();
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? '587') || 587;
  const secure = (process.env.SMTP_SECURE ?? (port === 465 ? 'true' : 'false')).toLowerCase() === 'true';
  return { host, port, secure, user, pass, from: (process.env.SMTP_FROM ?? '').trim() || user };
}

function b64(s: string | Buffer): string {
  return Buffer.from(s).toString('base64');
}

function randomBoundary(): string {
  return `----ykp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Encode a header value with non-ASCII chars (RFC 2047). */
export function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${b64(value)}?=`;
}

/**
 * Build a multipart/mixed MIME message (HTML body + attachments).
 * Pure — unit-tested.
 */
export function buildMimeMessage(opts: {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  attachments: Attachment[];
  boundary?: string;
  date?: string;
  messageId?: string;
}): string {
  const boundary = opts.boundary ?? randomBoundary();
  const messageId = opts.messageId ?? `<${Date.now()}.${Math.random().toString(36).slice(2)}@ykp-hr>`;
  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    `Date: ${opts.date ?? new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    'This is a multi-part message in MIME format.',
    ''
  ];
  lines.push(
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    ...chunk(b64(opts.htmlBody), 76),
    ''
  );
  for (const a of opts.attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${a.contentType}; name="${encodeHeader(a.filename)}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${encodeHeader(a.filename)}"`,
      '',
      ...chunk(b64(a.content), 76),
      ''
    );
  }
  lines.push(`--${boundary}--`, '');
  return lines.join('\r\n');
}

function chunk(s: string, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

interface SmtpConn {
  send(cmd: string): Promise<string>;
  close(): void;
}

async function connect(cfg: SmtpConfig, timeoutMs: number): Promise<SmtpConn> {
  const socket: net.Socket = cfg.secure
    ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
    : net.connect({ host: cfg.host, port: cfg.port });
  socket.setTimeout(timeoutMs);

  let buf = '';
  const waiters: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = [];
  let live: net.Socket = socket;
  const fail = (e: Error) => {
    const w = waiters.splice(0);
    for (const { reject } of w) reject(e);
    try {
      live.destroy();
    } catch {
      /* already gone */
    }
  };
  socket.on('data', (d: Buffer) => {
    buf += d.toString('utf8');
    // Multi-line reply ends when a line starts with "DDD " (space).
    const lines = buf.split('\r\n');
    if (lines.length >= 2) {
      const prev = lines[lines.length - 2] ?? '';
      if (/^\d{3} /.test(prev)) {
        const full = buf;
        buf = '';
        const w = waiters.shift();
        if (w) w.resolve(full);
      }
    }
  });
  socket.on('error', fail);
  socket.on('timeout', () => fail(new Error('SMTP timeout')));

  const greeting = await new Promise<string>((resolve, reject) => {
    waiters.push({ resolve, reject });
  });
  if (!greeting.startsWith('220')) throw new Error(`SMTP greeting rejected: ${greeting.trim()}`);

  const send = (cmd: string): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      waiters.push({ resolve, reject });
      socket.write(cmd + '\r\n', (err) => {
        if (err) reject(err);
      });
    });

  const expectCode = (reply: string, codes: string[], cmd: string) => {
    const code = reply.slice(0, 3);
    if (!codes.includes(code)) throw new Error(`SMTP ${cmd} rejected: ${reply.trim()}`);
    return reply;
  };

  let sock: net.Socket = socket;
  let r = expectCode(await send(`EHLO ykp-hr-v1`), ['250'], 'EHLO');
  if (!cfg.secure && /^250[-\s].*STARTTLS/im.test(r)) {
    expectCode(await send('STARTTLS'), ['220'], 'STARTTLS');
    const upgraded = tls.connect({
      socket: sock,
      host: cfg.host,
      port: cfg.port,
      servername: cfg.host
    });
    // Re-wire events onto the upgraded socket.
    sock.removeAllListeners();
    sock = upgraded;
    live = upgraded;
    sock.setTimeout(timeoutMs);
    sock.on('data', (d: Buffer) => {
      buf += d.toString('utf8');
      const lines = buf.split('\r\n');
      if (lines.length >= 2) {
        const prev = lines[lines.length - 2] ?? '';
        if (/^\d{3} /.test(prev)) {
          const full = buf;
          buf = '';
          const w = waiters.shift();
          if (w) w.resolve(full);
        }
      }
    });
    sock.on('error', fail);
    sock.on('timeout', () => fail(new Error('SMTP timeout')));
    r = expectCode(await send(`EHLO ykp-hr-v1`), ['250'], 'EHLO');
    void r;
  }

  expectCode(await send('AUTH LOGIN'), ['334'], 'AUTH');
  expectCode(await send(b64(cfg.user)), ['334'], 'AUTH user');
  expectCode(await send(b64(cfg.pass)), ['235'], 'AUTH pass');

  return {
    send,
    close: () => {
      try {
        sock.write('QUIT\r\n', () => sock.destroy());
      } catch {
        sock.destroy();
      }
    }
  };
}

/**
 * Send one email. Throws on any SMTP failure (caller maps to 502/503).
 * Resolves with the generated Message-ID for audit trails.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
  timeoutMs?: number;
}): Promise<{ messageId: string }> {
  const cfg = smtpConfig();
  if (!cfg) throw new Error('SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS)');
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@ykp-hr>`;
  const raw = buildMimeMessage({
    from: cfg.from,
    to: opts.to,
    subject: opts.subject,
    htmlBody: opts.html,
    attachments: opts.attachments ?? [],
    messageId
  });
  const conn = await connect(cfg, opts.timeoutMs ?? 15000);
  try {
    const expectCode = (reply: string, codes: string[], cmd: string) => {
      if (!codes.includes(reply.slice(0, 3))) throw new Error(`SMTP ${cmd} rejected: ${reply.trim()}`);
    };
    expectCode(await conn.send(`MAIL FROM:<${cfg.from}>`), ['250'], 'MAIL FROM');
    expectCode(await conn.send(`RCPT TO:<${opts.to}>`), ['250', '251'], 'RCPT TO');
    expectCode(await conn.send('DATA'), ['354'], 'DATA');
    // End-of-data: raw + <CRLF>.<CRLF>; dot-stuff lines starting with '.'.
    // conn.send appends its own CRLF, so the terminator line '.' is complete.
    const stuffed = raw
      .split('\r\n')
      .map((l) => (l.startsWith('.') ? `.${l}` : l))
      .join('\r\n');
    const dataReply = await conn.send(`${stuffed}\r\n.`);
    expectCode(dataReply, ['250'], 'DATA body');
  } finally {
    conn.close();
  }
  return { messageId };
}
