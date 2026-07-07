import { YoutubeTranscript } from 'youtube-transcript';
import { logger } from './logger.js';

export async function fetchTranscript(url: string): Promise<string> {
  let lastErr = '';
  try {
    const res = await YoutubeTranscript.fetchTranscript(url);
    if (res && res.length > 0) {
      return res.map((r) => r.text).join(' ');
    }
  } catch (err) {
    lastErr = (err as Error).message;
    logger.warn({ url, err: lastErr }, 'youtube-transcript primary failed');
  }

  try {
    const fallback = await youtubeiFallback(url);
    if (fallback) return fallback;
  } catch (err) {
    lastErr = (err as Error).message;
    logger.warn({ url, err: lastErr }, 'youtubei fallback failed');
  }

  throw new Error(`Unable to fetch transcript for ${url}: ${lastErr || 'no captions'}`);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function youtubeiFallback(url: string): Promise<string | null> {
  try {
    const mod: any = await import('youtubei.js');
    const Innertube = mod.Innertube ?? mod.default;
    const yt = await Innertube.create();
    const id = extractVideoId(url);
    if (!id) return null;
    const info = await yt.getInfo(id);
    const transcript = await info.getTranscript();
    const segments = transcript?.selectedContent?.body?.initial_segments;
    if (!segments || segments.length === 0) return null;
    return segments.map((s: any) => s?.snippet?.text ?? '').join(' ');
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}