import { latestBattleTime } from './matches.js';

export function emptySession() {
  return {
    status: 'idle',
    startedAt: null,
    endedAt: null,
    startingElo: null,
    startingRank: null,
    wins: 0,
    losses: 0,
    draws: 0,
    bestStreak: 0,
    currentStreak: 0,
    streakType: null,
    lastBattleTime: 0,
  };
}

export function startSession(profile, battlelog) {
  const now = new Date().toISOString();
  return {
    ...emptySession(),
    status: 'active',
    startedAt: now,
    startingElo: Number.isFinite(profile?.rankedElo) ? profile.rankedElo : null,
    startingRank: profile?.rankedRankName || null,
    lastBattleTime: latestBattleTime(battlelog),
  };
}

export function endSession(session) {
  return { ...session, status: 'ended', endedAt: new Date().toISOString() };
}

// Applies a chronological list of matches to a session and returns a new object.
export function applyMatches(session, matches) {
  const next = {
    ...session,
    wins: session.wins,
    losses: session.losses,
    draws: session.draws,
    currentStreak: session.currentStreak,
    bestStreak: session.bestStreak,
    streakType: session.streakType,
  };
  for (const match of matches) {
    if (match.result === 'win') {
      next.wins += 1;
      next.currentStreak = next.streakType === 'win' ? next.currentStreak + 1 : 1;
      next.streakType = 'win';
    } else if (match.result === 'loss') {
      next.losses += 1;
      next.currentStreak = next.streakType === 'loss' ? next.currentStreak + 1 : 1;
      next.streakType = 'loss';
    } else {
      next.draws += 1;
    }
    if (next.currentStreak > next.bestStreak) next.bestStreak = next.currentStreak;
    if (match.time > next.lastBattleTime) next.lastBattleTime = match.time;
  }
  return next;
}