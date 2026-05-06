// St. George template assets, inlined as base64 data URLs at module load.
// Embedding the bytes directly (rather than serving them over HTTP) keeps
// rendering deterministic — no CDN dependency, no missing-file edge cases,
// and Puppeteer doesn't need network access for these requests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const toDataUrl = (filename: string, mime = 'image/png'): string => {
  const buf = readFileSync(join(here, filename));
  return `data:${mime};base64,${buf.toString('base64')}`;
};

export const ST_GEORGE_LOGO_DATA_URL = toDataUrl('logo.png');
export const ST_GEORGE_SEAL_DATA_URL = toDataUrl('seal.png');
