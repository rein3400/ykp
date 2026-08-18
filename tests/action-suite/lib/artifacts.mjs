import fs from 'node:fs';
import path from 'node:path';
import { safeName } from './dom.mjs';

export function actionScreenshotDir(outDir, moduleId, actionId) {
  const dir = path.join(outDir, 'screenshots', moduleId, safeName(actionId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeEvidence(outDir, moduleId, actionId, data) {
  const dir = actionScreenshotDir(outDir, moduleId, actionId);
  const fpath = path.join(dir, 'evidence.json');
  fs.writeFileSync(fpath, JSON.stringify(data, null, 2));
  return fpath;
}

export function screenshotPath(dir, name) {
  return path.join(dir, `${safeName(name)}.png`);
}
