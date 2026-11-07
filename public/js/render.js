import { formatNumber, signed, rankLabel } from './format.js';
import { applyTheme } from './themes.js';

const $ = (id) => document.getElementById(id);

const el = {
  widget: $('widget'),
  rankIcon: $('rankIcon'),
  playerName: $('playerName'),
  rankTier: $('rankTier'),
  rankDiv: $('rankDiv'),
  elo: $('elo'),
  changePop: $('changePop'),
  peakText: $('peakText'),
  recW: $('recW'),
  recL: $('recL'),
  streakCard: $('streakCard'),
  streakNum: $('streakNum'),
  streakTag: $('streakTag'),
  sessionCard: $('sessionCard'),
  sessionChange: $('sessionChange'),
  formDots: $('formDots'),
  credit: $('credit'),
  status: $('status'),
  statusText: $('statusText'),
  waiting: $('waiting'),
  panel: document.querySelector('.panel'),
  celebration: $('celebration'),
};

const ICON = {
  win: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.3L19 7" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  loss: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>',
  draw: '<svg viewBox="0 0 24 24"><path d="M6 12h12" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>',
};

let last = { elo: null, form: [], rendered: false };
let eloAnim = 0;
let popTimer = 0;

function animateElo(from, to) {
  cancelAnimationFrame(eloAnim);
  if (!last.rendered || from == null || to == null || from === to) {
    el.elo.textContent = formatNumber(to);
    return;
  }
  const start = performance.now();
  const span = 600;
  const step = (now) => {
    const t = Math.min(1, (now - start) / span);
    const eased = 1 - Math.pow(1 - t, 3);
    el.elo.textContent = formatNumber(from + (to - from) * eased);
    if (t < 1) eloAnim = requestAnimationFrame(step);
  };
  eloAnim = requestAnimationFrame(step);
}

function showDelta(delta) {
  clearTimeout(popTimer);
  el.changePop.className = 'change-pop';
  if (!Number.isFinite(delta) || delta === 0) return;
  // force reflow so the animation restarts
  void el.changePop.offsetWidth;
  el.changePop.textContent = signed(delta);
  el.changePop.className = `change-pop ${delta > 0 ? 'up' : 'down'}`;
  popTimer = window.setTimeout(() => {
    el.changePop.className = 'change-pop';
    el.changePop.textContent = '';
  }, 1700);
}

function renderForm(form) {
  const list = Array.isArray(form) ? form.slice(-8) : [];
  const padded = [...Array(Math.max(0, 8 - list.length)).fill(''), ...list];
  const previous = last.form;
  el.formDots.replaceChildren();
  padded.forEach((value, index) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const key = value === 'W' ? 'win' : value === 'L' ? 'loss' : value === 'D' ? 'draw' : 'empty';
    chip.classList.add(key);
    if (key !== 'empty') chip.innerHTML = ICON[key];
    // pop only the newest, newly-arrived result
    if (last.rendered && key !== 'empty' && padded.length && index === padded.length - 1 && previous[previous.length - 1] !== value) {
      chip.classList.add('fresh');
    }
    el.formDots.appendChild(chip);
  });
  last.form = list;
}

function renderStreak(session) {
  const kind = session?.streakType;
  const count = session?.currentStreak || 0;
  let dataKind = 'none';
  let tag = 'STREAK';
  if (kind === 'win' && count > 0) {
    dataKind = 'win';
    tag = 'ON FIRE';
  } else if (kind === 'loss' && count > 0) {
    dataKind = 'loss';
    tag = 'COLD';
  }
  el.streakCard.dataset.kind = dataKind;
  el.streakNum.textContent = String(count);
  el.streakTag.textContent = tag;
}

function renderSession(session) {
  const change = session?.change;
  const value = Number.isFinite(change) ? change : 0;
  el.sessionCard.dataset.kind = value > 0 ? 'pos' : value < 0 ? 'neg' : 'zero';
  el.sessionChange.textContent = signed(value);
}

export function render(state, options = {}) {
  if (!state || !state.ok) {
    el.waiting.hidden = false;
    el.panel.style.visibility = 'hidden';
    return;
  }
  el.waiting.hidden = true;
  el.panel.style.visibility = 'visible';

  const rank = state.rank || {};
  applyTheme(el.widget, el.widget.dataset.theme, rank);

  el.rankIcon.src = `/ranks/${rank.icon || 'Mythic.png'}`;
  el.rankIcon.alt = `${rank.tier || ''} rank emblem`;
  el.playerName.textContent = state.player?.name || 'player';
  el.rankTier.textContent = String(rank.short || '').toUpperCase();
  el.rankDiv.textContent = rank.division || '';
  const titleLen = `${rank.short || ''} ${rank.division || ''}`.trim().length;
  const titleSize = titleLen <= 8 ? 62 : titleLen <= 10 ? 56 : titleLen <= 12 ? 50 : 44;
  el.widget.style.setProperty('--title-size', `${titleSize}px`);

  const elo = Number.isFinite(state.elo) ? state.elo : null;
  animateElo(last.elo, elo);
  if (last.rendered && last.elo != null && elo != null && elo !== last.elo) {
    showDelta(elo - last.elo);
    el.rankIcon.classList.add('pop');
    window.setTimeout(() => el.rankIcon.classList.remove('pop'), 380);
  }
  last.elo = elo;

  const peak = state.peak;
  if (peak && peak.label) {
    el.peakText.textContent = `PEAK ${rankLabel(peak.label)}${Number.isFinite(peak.elo) ? ` · ${formatNumber(peak.elo)}` : ''}`;
  } else {
    el.peakText.textContent = 'PEAK —';
  }

  el.recW.innerHTML = `${state.session?.wins ?? 0}<em>W</em>`;
  el.recL.innerHTML = `${state.session?.losses ?? 0}<em>L</em>`;
  renderStreak(state.session);
  renderSession(state.session);
  renderForm(state.form);

  if (state.credit) {
    el.credit.hidden = false;
    el.credit.textContent = state.credit;
  } else {
    el.credit.hidden = true;
  }

  if (options.status) {
    el.status.hidden = !options.status.visible;
    el.statusText.textContent = options.status.text;
    el.status.className = `status ${options.status.cls || ''}`.trim();
  }

  last.rendered = true;
}

export function elements() {
  return el;
}

export function prettyRank(name) {
  return rankLabel(name);
}