import { config } from './config.js';

async function call(path) {
  if (!config.token) throw new Error('Missing BRAWL_API_TOKEN');
  const res = await fetch(`${config.apiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.reason || body?.message || '';
    } catch {
      /* ignore */
    }
    const err = new Error(`Brawl API ${res.status}${detail ? `: ${detail}` : ''}`);
    err.status = res.status;
    const retry = Number(res.headers.get('retry-after'));
    if (Number.isFinite(retry) && retry > 0) err.retryAfterMs = retry * 1000;
    throw err;
  }
  return res.json();
}

export function fetchPlayer(tag) {
  return call(`/players/${encodeURIComponent(tag)}`);
}

export function fetchBattlelog(tag) {
  return call(`/players/${encodeURIComponent(tag)}/battlelog`);
}