import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import { db, schema } from '../db/index.js';
import { env } from '../config/env.js';
import { sendToOwner } from '../modules/telegram-bot.js';
import { logSystem } from '../services/logger.js';
import { nanoid } from 'nanoid';

const execAsync = promisify(exec);

export async function runBackup(): Promise<{ ok: boolean; filename?: string; sizeBytes?: number; error?: string }> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
  const filename = `backup_${date}.sql`;
  const outDir = env.BACKUP_DIR;
  const outPath = path.join(outDir, filename);

  try {
    await fs.mkdir(outDir, { recursive: true });
    const url = new URL(env.DATABASE_URL);
    const user = url.username;
    const pass = url.password;
    const host = url.hostname;
    const port = url.port || '5432';
    const dbName = url.pathname.replace(/^\//, '');

    await execAsync(
      `pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} -f "${outPath}"`,
      { env: { ...process.env, PGPASSWORD: pass } }
    );
    const stat = await fs.stat(outPath);

    // Retention: keep newest 14 dumps, unlink older.
    await pruneOldBackups(outDir).catch((e) => logSystem('warn', 'backup', `retention prune failed: ${(e as Error).message}`));

    await db.insert(schema.backups).values({
      id: `BK-${nanoid(12)}`,
      filename,
      path: outPath,
      sizeBytes: stat.size,
      status: 'success'
    });
    await sendToOwner(`YKP BACKUP STATUS\nBackup: SUCCESS\nTime: ${new Date().toISOString()}\nFile: ${filename}\nSize: ${Math.round(stat.size / 1024)} KB`);
    await logSystem('info', 'backup', 'backup succeeded', { filename, size: stat.size });
    return { ok: true, filename, sizeBytes: stat.size };
  } catch (err) {
    const msg = (err as Error).message;
    await db.insert(schema.backups).values({
      id: `BK-${nanoid(12)}`,
      filename,
      path: outPath,
      sizeBytes: 0,
      status: 'failed'
    }).catch(() => {});
    await sendToOwner(`YKP BACKUP STATUS\nBackup: FAILED\nError: ${msg}`);
    await logSystem('error', 'backup', `backup failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

const KEEP_BACKUPS = 14;

async function pruneOldBackups(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const dumps = entries
    .filter((e) => e.isFile() && e.name.startsWith('backup_') && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort()
    .reverse();
  for (const old of dumps.slice(KEEP_BACKUPS)) {
    await fs.unlink(path.join(dir, old));
    await logSystem('info', 'backup', `pruned old dump ${old}`);
  }
}