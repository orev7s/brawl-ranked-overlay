import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

function readEnvFile(file) {
  const out = {};
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function normalizeTag(tag) {
  if (!tag) return '';
  const clean = String(tag).trim().toUpperCase().replace(/^#/, '').replace(/\s+/g, '');
  return clean ? `#${clean}` : '';
}

const fileEnv = readEnvFile(path.join(ROOT, '.env'));
const env = { ...fileEnv, ...process.env };

const port = Number(env.PORT || 8786);
const pollMs = Math.max(15000, Number(env.POLL_MS || 20000));

export const config = {
  root: ROOT,
  publicDir: path.join(ROOT, 'public'),
  dataDir: path.join(ROOT, 'data'),
  sessionFile: path.join(ROOT, 'data', 'session.json'),
  token: (env.BRAWL_API_TOKEN || '').trim(),
  playerTag: normalizeTag(env.PLAYER_TAG || ''),
  port: Number.isFinite(port) ? port : 8786,
  pollMs: Number.isFinite(pollMs) ? pollMs : 20000,
  controlToken: (env.CONTROL_TOKEN || '').trim(),
  demo: env.DEMO === '1' || env.DEMO === 'true',
  credit: (env.OVERLAY_CREDIT || '').trim(),
  apiBase: 'https://api.brawlstars.com/v1',
};