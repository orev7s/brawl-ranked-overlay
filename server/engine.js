import fs from 'node:fs';
import { config } from './config.js';
import { parseRank, rankDirection, rankFromElo, demoSwing } from './rank.js';
import { emptySession, startSession, endSession, applyMatches } from './session.js';
import { rankedMatches, latestBattleTime } from './matches.js';
import { fetchPlayer, fetchBattlelog } from './brawlApi.js';

const MAX_FORM = 8;

function iconUrl(profile) {
  const id = profile?.icon?.id;
  return Number.isFinite(id) ? `https://cdn.brawlify.com/profile-icons/regular/${id}.png` : '';
}

function demoProfile() {
  const elo = 4848;
  return {
    tag: config.playerTag || '#2PQ0LRVGR',
    name: 'v80q',
    icon: { id: 28000988 },
    rankedElo: elo,
    rankedRankName: rankFromElo(elo).name,
    highestAllTimeRankedRankName: rankFromElo(7051).name,
    highestAllTimeRankedElo: 7051,
    highestSeasonRankedRankName: rankFromElo(5110).name,
    highestSeasonRankedElo: 5110,
  };
}

export class Engine {
  constructor() {
    this.session = emptySession();
    this.profile = null;
    this.battlelog = { items: [] };
    this.matches = [];
    this.lastBattleTime = 0;
    this.lastRankName = null;
    this.lastElo = null;
    this.primed = false;
    this.celebration = null;
    this.celebrationSeq = 0;
    this.source = config.demo ? 'demo' : 'live';
    this.error = null;
    this.fetching = false;
    this.fetchedAt = null;
    this.demo = demoProfile();
    this.demoState = this.makeDemoState();
    this.demoAuto = config.demo;
    this.load();
  }

  makeDemoState(elo) {
    return {
      status: 'demo',
      startedAt: new Date().toISOString(),
      wins: 0,
      losses: 0,
      draws: 0,
      streakType: null,
      currentStreak: 0,
      bestStreak: 0,
      form: [],
      startingElo: Number.isFinite(elo) ? elo : this.demo.rankedElo,
    };
  }

  recordDemoResult(action) {
    const d = this.demoState;
    if (action === 'win') {
      d.wins += 1;
      d.currentStreak = d.streakType === 'win' ? d.currentStreak + 1 : 1;
      d.streakType = 'win';
    } else if (action === 'loss') {
      d.losses += 1;
      d.currentStreak = d.streakType === 'loss' ? d.currentStreak + 1 : 1;
      d.streakType = 'loss';
    } else {
      return;
    }
    d.bestStreak = Math.max(d.bestStreak, d.currentStreak);
    d.form.push(action === 'win' ? 'W' : 'L');
    if (d.form.length > 8) d.form = d.form.slice(-8);
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(config.sessionFile, 'utf8'));
      if (saved && typeof saved === 'object') {
        if (saved.session) this.session = { ...emptySession(), ...saved.session };
        this.lastBattleTime = Number(saved.lastBattleTime) || 0;
        this.lastRankName = saved.lastRankName || null;
        this.lastElo = Number.isFinite(saved.lastElo) ? saved.lastElo : null;
        this.primed = saved.primed === true;
        this.celebrationSeq = Number(saved.celebrationSeq) || 0;
        if (saved.demo) this.demo = { ...this.demo, ...saved.demo };
        if (saved.demoState) this.demoState = { ...this.demoState, ...saved.demoState };
      }
    } catch {
      /* first run */
    }
  }

  save() {
    const payload = {
      session: this.session,
      lastBattleTime: this.lastBattleTime,
      lastRankName: this.lastRankName,
      lastElo: this.lastElo,
      primed: this.primed,
      celebrationSeq: this.celebrationSeq,
      demo: this.demo,
      demoState: this.demoState,
      updatedAt: new Date().toISOString(),
    };
    try {
      fs.mkdirSync(config.dataDir, { recursive: true });
      fs.writeFileSync(config.sessionFile, JSON.stringify(payload, null, 2));
    } catch {
      /* non-fatal */
    }
  }

  ingest(profile, battlelog) {
    if (!profile) return;
    const tag = profile.tag || config.playerTag;
    const matches = rankedMatches(battlelog, tag);
    const maxTime = latestBattleTime(battlelog);

    let newMatches = [];
    if (!this.primed) {
      this.primed = true;
      this.lastBattleTime = Math.max(this.lastBattleTime, maxTime);
    } else {
      newMatches = matches.filter((m) => m.time > this.lastBattleTime);
    }

    if (this.source !== 'demo' && this.session.status === 'active' && newMatches.length) {
      const started = Date.parse(this.session.startedAt) || 0;
      const fresh = newMatches.filter((m) => m.time > started && m.time > this.session.lastBattleTime);
      if (fresh.length) this.session = applyMatches(this.session, fresh);
    }

    const nextRankName = profile.rankedRankName || null;
    let kind = null;
    let from = this.lastRankName;
    let to = nextRankName;
    if (this.lastRankName && nextRankName && nextRankName !== this.lastRankName) {
      const dir = rankDirection(this.lastRankName, nextRankName);
      if (dir > 0) kind = 'rankup';
      else if (dir < 0) kind = 'rankdown';
    }
    if (!kind && newMatches.length) {
      const last = newMatches[newMatches.length - 1];
      if (last.result === 'win') kind = 'win';
      else if (last.result === 'loss') kind = 'loss';
    }
    if (kind) {
      // Carry the Elo on both sides of the event so the overlay never has to
      // infer the change from whatever frame happens to arrive next.
      this.celebration = {
        id: ++this.celebrationSeq,
        kind,
        from,
        to,
        fromElo: Number.isFinite(this.lastElo) ? this.lastElo : null,
        toElo: Number.isFinite(profile.rankedElo) ? profile.rankedElo : null,
        at: Date.now(),
      };
    }

    if (maxTime > this.lastBattleTime) this.lastBattleTime = maxTime;
    this.profile = profile;
    this.battlelog = battlelog || { items: [] };
    this.matches = matches.slice(-24);
    this.lastRankName = nextRankName;
    this.lastElo = Number.isFinite(profile.rankedElo) ? profile.rankedElo : null;
    this.fetchedAt = new Date().toISOString();
    this.error = null;
    this.save();
  }

  async poll() {
    if (this.source === 'demo') {
      if (this.demoAuto) this.demoPoll();
      return;
    }
    if (!config.token || !config.playerTag) {
      this.error = 'Set BRAWL_API_TOKEN and PLAYER_TAG in .env';
      return;
    }
    this.fetching = true;
    try {
      const [profile, battlelog] = await Promise.all([
        fetchPlayer(config.playerTag),
        fetchBattlelog(config.playerTag),
      ]);
      // The operator may have switched to demo while this request was in
      // flight. Do not let a stale live response overwrite the demo state.
      if (this.source !== 'live') return;
      this.ingest(profile, battlelog);
    } catch (err) {
      this.error = err?.message || 'Brawl API request failed';
    } finally {
      this.fetching = false;
    }
  }

  demoPoll(force) {
    const roll = Math.random();
    let action = force || 'win';
    if (!force) {
      if (roll > 0.94) action = 'reset';
      else if (roll > 0.9) action = 'rankup';
      else if (roll > 0.86) action = 'rankdown';
      else if (roll > 0.56) action = 'loss';
    }

    if (action === 'reset') {
      this.demo = demoProfile();
      this.demoState = this.makeDemoState(this.demo.rankedElo);
    } else if (action === 'rankup') {
      const rank = rankFromElo(this.demo.rankedElo);
      // Cross into the next rank at its real floor. Pro is the ceiling.
      this.demo.rankedElo = rank.nextFloor != null ? rank.nextFloor : this.demo.rankedElo + 100;
    } else if (action === 'rankdown') {
      const rank = rankFromElo(this.demo.rankedElo);
      // Land just under the current rank's floor so the rank actually drops.
      this.demo.rankedElo = Math.max(0, rank.floor - 1);
    } else {
      this.demo.rankedElo = Math.max(0, this.demo.rankedElo + demoSwing(this.demo.rankedElo, action === 'win'));
      this.recordDemoResult(action);
    }
    this.demo.rankedRankName = rankFromElo(this.demo.rankedElo).name;
    const profile = { ...this.demo };
    if (this.demo.rankedElo > (this.demo.highestAllTimeRankedElo || 0)) {
      this.demo.highestAllTimeRankedElo = this.demo.rankedElo;
      this.demo.highestAllTimeRankedRankName = this.demo.rankedRankName;
      profile.highestAllTimeRankedElo = this.demo.highestAllTimeRankedElo;
      profile.highestAllTimeRankedRankName = this.demo.highestAllTimeRankedRankName;
    }
    this.source = 'demo';
    const isReal = action === 'win' || action === 'loss';
    const battlelog = isReal
      ? {
          items: [
            {
              battleTime: new Date().toISOString(),
              event: { mode: 'ranked', map: 'Demo Arena' },
              battle: { type: 'ranked', mode: 'gemGrab', result: action === 'win' ? 'victory' : 'defeat', players: [{ tag: profile.tag, name: profile.name, brawler: { name: 'SHELLY' } }] },
            },
          ],
        }
      : { items: [] };
    this.ingest(profile, battlelog);
    this.fetching = false;
  }

  action(name) {
    if (name === 'start' || name === 'reset') {
      this.session = startSession(this.profile, this.battlelog);
      this.lastBattleTime = Math.max(this.lastBattleTime, this.session.lastBattleTime);
      this.save();
    } else if (name === 'end') {
      this.session = endSession(this.session);
      this.save();
    }
  }

  setDemo(on) {
    if (!on) {
      // Returning to live: forget the fabricated timeline so the next poll
      // re-primes from the real battlelog instead of a future demo timestamp.
      this.lastBattleTime = 0;
      this.lastRankName = null;
      this.primed = false;
      this.celebration = null;
      this.demoAuto = false;
    } else {
      // Start the demo from whatever the live profile shows, so rank-ups and
      // rank-downs land on the real thresholds for your actual Elo.
      if (Number.isFinite(this.profile?.rankedElo)) {
        this.demo.rankedElo = this.profile.rankedElo;
        this.demo.rankedRankName = rankFromElo(this.demo.rankedElo).name;
      }
      this.demoState = this.makeDemoState(this.demo.rankedElo);
      this.celebration = null;
      this.demoAuto = true;
    }
    this.source = on ? 'demo' : 'live';
    this.save();
  }

  forceDemo(action) {
    if (this.source !== 'demo') {
      if (Number.isFinite(this.profile?.rankedElo)) this.demo.rankedElo = this.profile.rankedElo;
      this.demo.rankedRankName = rankFromElo(this.demo.rankedElo).name;
      this.demoState = this.makeDemoState(this.demo.rankedElo);
    }
    this.source = 'demo';
    this.demoAuto = false;
    if (!this.lastRankName) this.lastRankName = this.demo.rankedRankName;
    this.primed = true;
    this.demoPoll(action);
  }

  state() {
    const p = this.profile;
    const demo = this.source === 'demo';
    const elo = Number.isFinite(p?.rankedElo) ? p.rankedElo : null;
    const rank = parseRank(p?.rankedRankName, elo);
    const form = demo
      ? [...this.demoState.form]
      : this.matches.slice(-MAX_FORM).map((m) => (m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : 'D'));
    const active = demo ? this.demoState : this.session;
    const starting = active.startingElo;
    const change = starting != null && elo != null ? elo - starting : null;
    return {
      ok: !!p,
      source: this.source,
      fetching: this.fetching,
      error: this.error,
      fetchedAt: this.fetchedAt,
      pollMs: config.pollMs,
      credit: config.credit,
      player: { tag: p?.tag || config.playerTag, name: p?.name || '', iconUrl: iconUrl(p) },
      rank,
      elo,
      peak: { label: p?.highestAllTimeRankedRankName || null, elo: Number.isFinite(p?.highestAllTimeRankedElo) ? p.highestAllTimeRankedElo : null },
      seasonPeak: { label: p?.highestSeasonRankedRankName || null, elo: Number.isFinite(p?.highestSeasonRankedElo) ? p.highestSeasonRankedElo : null },
      session: {
        status: active.status,
        startedAt: active.startedAt,
        endedAt: active.endedAt,
        wins: active.wins,
        losses: active.losses,
        draws: active.draws,
        total: active.wins + active.losses + active.draws,
        streakType: active.streakType,
        currentStreak: active.currentStreak,
        bestStreak: active.bestStreak,
        change,
      },
      form,
      celebration: this.celebration,
    };
  }
}