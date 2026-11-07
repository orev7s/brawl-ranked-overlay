// The Ranked ladder. Thresholds are the community-checked table (Supercell does
// not publish one). There are 22 ranks: Bronze through Masters have three
// divisions each, and Pro is a single rank with no division.
export const LADDER = [
  { tier: 'Bronze', division: 'I', min: 0 },
  { tier: 'Bronze', division: 'II', min: 250 },
  { tier: 'Bronze', division: 'III', min: 500 },
  { tier: 'Silver', division: 'I', min: 750 },
  { tier: 'Silver', division: 'II', min: 1000 },
  { tier: 'Silver', division: 'III', min: 1250 },
  { tier: 'Gold', division: 'I', min: 1500 },
  { tier: 'Gold', division: 'II', min: 2000 },
  { tier: 'Gold', division: 'III', min: 2500 },
  { tier: 'Diamond', division: 'I', min: 3000 },
  { tier: 'Diamond', division: 'II', min: 3500 },
  { tier: 'Diamond', division: 'III', min: 4000 },
  { tier: 'Mythic', division: 'I', min: 4500 },
  { tier: 'Mythic', division: 'II', min: 5000 },
  { tier: 'Mythic', division: 'III', min: 5500 },
  { tier: 'Legendary', division: 'I', min: 6000 },
  { tier: 'Legendary', division: 'II', min: 6750 },
  { tier: 'Legendary', division: 'III', min: 7500 },
  { tier: 'Masters', division: 'I', min: 8250 },
  { tier: 'Masters', division: 'II', min: 9250 },
  { tier: 'Masters', division: 'III', min: 10250 },
  { tier: 'Pro', division: '', min: 11250 },
];

// Tier colours and emblem files. Colours match the in-game tier palette.
const TIER_META = {
  Bronze: { color: '#a25e2b', deep: '#5f3412', edge: '#db9152', icon: 'Bronze.png' },
  Silver: { color: '#89939e', deep: '#4d5a66', edge: '#c7d2de', icon: 'Silver.png' },
  Gold: { color: '#d9a514', deep: '#8a6a00', edge: '#ffdc4e', icon: 'Gold.png' },
  Diamond: { color: '#0097b3', deep: '#005a6b', edge: '#13e1f2', icon: 'Diamond.png' },
  Mythic: { color: '#bb086f', deep: '#6c0243', edge: '#ff6494', icon: 'Mythic.png' },
  Legendary: { color: '#a52638', deep: '#5f1520', edge: '#ff8692', icon: 'Legendary.png' },
  Masters: { color: '#34751c', deep: '#1c470d', edge: '#b3f36b', icon: 'Masters.png' },
  Pro: { color: '#303643', deep: '#171b23', edge: '#ffbe69', icon: 'Pro.png' },
};

const TIER_NAMES = Object.keys(TIER_META);
const DIVISIONS = ['I', 'II', 'III'];

function metaFor(tier) {
  return TIER_META[tier] || TIER_META.Bronze;
}

function entryName(entry) {
  return entry.division ? `${entry.tier.toUpperCase()} ${entry.division}` : entry.tier.toUpperCase();
}

function buildRank(index) {
  const i = Math.min(LADDER.length - 1, Math.max(0, index));
  const entry = LADDER[i];
  const meta = metaFor(entry.tier);
  const next = LADDER[i + 1] || null;
  return {
    key: entry.tier.toLowerCase(),
    tier: entry.tier,
    division: entry.division,
    short: entry.tier,
    label: entry.division ? `${entry.tier} ${entry.division}` : entry.tier,
    name: entryName(entry),
    color: meta.color,
    deep: meta.deep,
    edge: meta.edge,
    icon: meta.icon,
    index: i,
    floor: entry.min,
    nextFloor: next ? next.min : null,
  };
}

// Highest rank whose floor the Elo has reached. This is the single source of
// truth for "what rank is this Elo".
export function rankFromElo(points) {
  const p = Number.isFinite(points) ? points : 0;
  let index = 0;
  for (let i = 0; i < LADDER.length; i += 1) {
    if (p >= LADDER[i].min) index = i;
  }
  return buildRank(index);
}

export function ladderLength() {
  return LADDER.length;
}

function findTier(name) {
  const clean = String(name || '').trim().toUpperCase();
  return TIER_NAMES.find((tier) => clean.startsWith(tier.toUpperCase())) || null;
}

function indexOf(tier, division) {
  return LADDER.findIndex((e) => e.tier === tier && e.division === (division || ''));
}

// Parses an API rank name such as "MYTHIC II" or "PRO". The Elo is only used
// when the name omits a division (which only Pro legitimately does).
export function parseRank(name, points) {
  const tier = findTier(name);
  if (!tier) return rankFromElo(points);

  if (tier === 'Pro') return buildRank(indexOf('Pro', ''));

  const parts = String(name).trim().toUpperCase().split(/\s+/);
  let division = DIVISIONS.includes(parts[1]) ? parts[1] : '';
  if (!division) {
    // Name gave a tier but no division: fall back to the Elo-derived one.
    const byElo = rankFromElo(points);
    division = byElo.tier === tier ? byElo.division : 'I';
  }
  const idx = indexOf(tier, division);
  return buildRank(idx < 0 ? indexOf(tier, 'I') : idx);
}

// Moves up or down the flat ladder. Pro is the ceiling; Bronze I is the floor.
export function shiftRank(name, delta) {
  const current = parseRank(name);
  return buildRank(current.index + delta).name;
}

export function rankDirection(prevName, nextName) {
  const prev = parseRank(prevName);
  const next = parseRank(nextName);
  if (next.index > prev.index) return 1;
  if (next.index < prev.index) return -1;
  return 0;
}

// Signed Elo swing for a demo match. Wins are positive, losses negative, and
// Bronze never loses Elo.
export function demoSwing(points, won) {
  const tier = rankFromElo(points).tier;
  const gains = { Bronze: 100, Silver: 95, Gold: 85, Diamond: 80, Mythic: 80, Legendary: 65, Masters: 55, Pro: 50 };
  const losses = { Bronze: 0, Silver: 20, Gold: 45, Diamond: 60, Mythic: 80, Legendary: 95, Masters: 100, Pro: 105 };
  if (won) return (gains[tier] ?? 80) + Math.floor(Math.random() * 16);
  if (tier === 'Bronze') return 0;
  return -((losses[tier] ?? 60) + Math.floor(Math.random() * 12) - 6);
}
