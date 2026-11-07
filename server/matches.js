const WIN_RESULTS = new Set(['victory', 'win']);
const LOSS_RESULTS = new Set(['defeat', 'loss']);

// The API uses the compact ISO form: 20261107T152545.000Z. Node's Date.parse
// does not accept it, so normalise it before parsing.
const COMPACT = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/;

export function parseBattleTime(value) {
  if (!value) return 0;
  const match = COMPACT.exec(String(value));
  if (match) {
    const [, y, mo, d, h, mi, s, ms] = match;
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, +ms);
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// The API reports 3v3 outcomes as battle.result, but Ranked showdown only
// reports a placement. In showdown the top half of the lobby is a win.
export function deriveResult(battle) {
  if (!battle) return 'unknown';
  const result = String(battle.result || '').toLowerCase();
  if (WIN_RESULTS.has(result)) return 'win';
  if (LOSS_RESULTS.has(result)) return 'loss';
  if (result === 'draw') return 'draw';

  const change = battle.trophyChange;
  if (Number.isFinite(change)) {
    if (change > 0) return 'win';
    if (change < 0) return 'loss';
    return 'draw';
  }

  const place = battle.rank;
  const players = Array.isArray(battle.players) ? battle.players.length : 0;
  if (Number.isFinite(place) && players > 0) return place <= players / 2 ? 'win' : 'loss';
  return 'unknown';
}

export function matchId(item) {
  const b = item.battle || {};
  return `${item.battleTime}|${b.mode || b.type || ''}|${b.rank ?? b.result ?? ''}`;
}

export function toMatch(item, playerTag) {
  const b = item.battle || {};
  const event = item.event || {};
  const me = (b.players || []).find((p) => p.tag === playerTag) || null;
  return {
    id: matchId(item),
    at: item.battleTime,
    time: parseBattleTime(item.battleTime),
    result: deriveResult(b),
    mode: event.mode || b.mode || 'ranked',
    map: event.map || '',
    place: Number.isFinite(b.rank) ? b.rank : null,
    brawler: me?.brawler?.name || '',
    trophyChange: Number.isFinite(b.trophyChange) ? b.trophyChange : null,
  };
}

export function rankedMatches(battlelog, playerTag) {
  const items = Array.isArray(battlelog?.items) ? battlelog.items : [];
  return items
    .filter((item) => item?.battle?.type === 'ranked')
    .map((item) => toMatch(item, playerTag))
    .filter((m) => m.time > 0)
    .sort((a, b) => a.time - b.time);
}

export function latestBattleTime(battlelog) {
  const items = Array.isArray(battlelog?.items) ? battlelog.items : [];
  let max = 0;
  for (const item of items) {
    const t = parseBattleTime(item?.battleTime);
    if (t > max) max = t;
  }
  return max;
}