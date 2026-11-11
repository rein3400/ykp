import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireProcessorLock } from './processor-lock';
describe('single-process bot serialization', () => {
  it('rejects overlap and releases after completion', async () => {
    const release = await acquireProcessorLock('overlap');
    await expect(acquireProcessorLock('overlap')).rejects.toThrow('busy');
    await release();
    const next = await acquireProcessorLock('overlap');
    await next();
  });
  it('ignores orphaned filesystem directories after process restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ops-lock-'));
    const path = join(root, 'lock');
    try {
      await mkdir(path);
      await mkdir(`${path}.recovery`);
      const release = await acquireProcessorLock(path);
      await release();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('does not let a stale releaser remove a newer lock', async () => {
    const release = await acquireProcessorLock('ownership');
    await release();
    const newer = await acquireProcessorLock('ownership');
    await expect(release()).rejects.toThrow('ownership');
    await expect(acquireProcessorLock('ownership')).rejects.toThrow('busy');
    await newer();
  });
});
