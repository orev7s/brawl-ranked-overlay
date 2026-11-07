import { render, elements } from './render.js';
import { play } from './celebrations.js';
import { subscribe, loadState } from './api.js';
import { rankLabel } from './format.js';
import { isTheme } from './themes.js';

const params = new URLSearchParams(location.search);
const widget = elements().widget;
const stage = document.getElementById('stage');

const LAYOUTS = ['horizontal', 'compact', 'vertical'];
const MOTIONS = ['off', 'normal'];
// Every block can be switched off with ?name=0 and so on.
const TOGGLES = ['icon', 'name', 'rank', 'points', 'record', 'streak', 'change', 'peak', 'form'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function flag(name) {
  return params.get(name) === '0' ? '0' : '1';
}

// Render scale: accept ?scale=1.2 or ?renderScale=120 (both 30% to 150%).
function readScale() {
  const rs = params.get('renderScale');
  if (rs != null) return clamp((Number(rs) || 100) / 100, 0.3, 1.5);
  const s = params.get('scale');
  if (s != null) {
    const n = Number(s);
    if (Number.isFinite(n)) return clamp(n > 3 ? n / 100 : n, 0.3, 1.5);
  }
  return 1;
}

const scale = readScale();
document.documentElement.style.setProperty('--scale', String(scale));

const layout = LAYOUTS.includes(params.get('layout')) ? params.get('layout') : 'horizontal';
widget.dataset.layout = layout;

const theme = isTheme(params.get('theme')) ? params.get('theme') : 'brawl-default';
widget.dataset.theme = theme;

widget.dataset.motion = MOTIONS.includes(params.get('motion')) ? params.get('motion') : 'normal';

for (const key of TOGGLES) widget.dataset[key] = flag(key);

const debug = params.get('debug') === '1';

function place() {
  const align = params.get('align') || 'top-left';
  const mx = Number(params.get('x')) || 48;
  const my = Number(params.get('y')) || 44;
  const width = widget.offsetWidth * scale;
  const height = widget.offsetHeight * scale;
  let left = mx;
  let top = my;
  if (align.includes('right')) left = Math.max(0, window.innerWidth - width - mx);
  if (align.includes('bottom')) top = Math.max(0, window.innerHeight - height - my);
  stage.style.left = `${left}px`;
  stage.style.top = `${top}px`;
}

let lastCelebration = null;
let booted = false;
let connected = false;

function statusFor(state) {
  if (!debug && !state?.error) return { visible: false };
  if (!connected) return { visible: true, text: 'OFFLINE - reconnecting', cls: 'offline' };
  if (state?.error) return { visible: true, text: state.error.slice(0, 70), cls: 'stale' };
  return { visible: true, text: `${state?.source || 'live'} · ${state?.rank?.label || ''}`, cls: '' };
}

function onState(state) {
  const firstFrame = !booted;
  booted = true;
  const celebration = state?.celebration;
  const celebrating = celebration && celebration.id !== lastCelebration;
  // Remember the id even when we skip playing it, so a stale celebration that
  // is already in the first payload never fires after a reload.
  if (celebration) lastCelebration = celebration.id;

  render(state, { status: statusFor(state) });

  if (celebrating && !firstFrame) {
    const delta = Number.isFinite(celebration.toElo) && Number.isFinite(celebration.fromElo)
      ? celebration.toElo - celebration.fromElo
      : null;
    play(celebration.kind, {
      from: celebration.from ? rankLabel(celebration.from) : '',
      to: celebration.to ? rankLabel(celebration.to) : '',
      delta,
    });
  }

  requestAnimationFrame(place);
}

async function boot() {
  try {
    const state = await loadState();
    onState(state);
  } catch {
    render(null);
  }

  subscribe({
    onState,
    onStatus: ({ connected: isConnected }) => {
      connected = isConnected;
      if (debug) {
        elements().status.hidden = !debug;
      }
      if (!isConnected) {
        render(null);
        elements().status.hidden = !debug;
      }
    },
  });
}

window.addEventListener('resize', () => requestAnimationFrame(place));
window.addEventListener('load', () => requestAnimationFrame(place));

boot();
