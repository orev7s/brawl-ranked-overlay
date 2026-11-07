import { render, elements } from './render.js';
import { play, stop } from './celebrations.js';
import { subscribe, loadState } from './api.js';
import { rankLabel } from './format.js';

const params = new URLSearchParams(location.search);
const widget = elements().widget;
const stage = document.getElementById('stage');

const MOTIONS = ['off', 'low', 'normal'];
const scale = clamp(Number(params.get('scale')) || 1, 0.3, 3);

document.documentElement.style.setProperty('--scale', String(scale));
widget.dataset.theme = params.get('theme') || 'midnight';
widget.dataset.motion = MOTIONS.includes(params.get('motion')) ? params.get('motion') : 'normal';
const debug = params.get('debug') === '1';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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
let connected = false;

function statusFor(state) {
  if (!debug && !state?.error) return { visible: false };
  if (!connected) return { visible: true, text: 'OFFLINE — reconnecting', cls: 'offline' };
  if (state?.error) return { visible: true, text: state.error.slice(0, 70), cls: 'stale' };
  return { visible: true, text: `${state?.source || 'live'} · ${state?.rank?.label || ''}`, cls: '' };
}

function onState(state) {
  const celebrating = state?.celebration && state.celebration.id !== lastCelebration;
  const isFirstFrame = lastCelebration === null;
  if (state?.celebration) lastCelebration = state.celebration.id;

  render(state, { status: statusFor(state) });

  if (celebrating && !isFirstFrame && state?.celebration) {
    const c = state.celebration;
    const delta = Number.isFinite(c.toElo) && Number.isFinite(c.fromElo) ? c.toElo - c.fromElo : null;
    play(c.kind, {
      from: c.from ? rankLabel(c.from) : '',
      to: c.to ? rankLabel(c.to) : '',
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