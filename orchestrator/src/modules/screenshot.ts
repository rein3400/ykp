// Screenshot analyzer placeholder — vision model integration pending
// MVP3.E: menerima image URL via Telegram atau POST /screenshot/analyze
// Return placeholder response saat ini.

import { logger } from '../services/logger.js';

export interface ScreenshotInput {
  imageUrl: string;
  context?: string;
}

export async function analyzeScreenshot(input: ScreenshotInput): Promise<{ ok: boolean; result: string }> {
  logger.info({ url: input.imageUrl }, 'screenshot.analyze (stub)');
  return {
    ok: false,
    result: 'AI vision belum aktif. Integrasi Gemini/Claude Vision menyusul di MVP3.E.'
  };
}