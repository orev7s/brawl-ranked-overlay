import { formatNumber, signed, rankLabel } from './format.js';

const key = new URLSearchParams(location.search).get('key');
const qs = key ? `?key=${encodeURIComponent(key)}` : '';

const $ = (id) => document.getElementById(id);

// --------------------------------------------------------------- overlay builder
const TOGGLES = [
  ['icon', 'Rank icon'],
  ['name', 'Player name'],
  ['rank', 'Rank name'],
  ['points', 'Ranked points'],
  ['record', 'Session W/L'],
  ['streak', 'Streak'],
  ['change', 'Session change'],
  ['peak', 'Peak rank'],
  ['form', 'Form strip'],
];

const opt = { layout: 'horizontal', theme: 'brawl-default', motion: 'normal', scale: 100, on: {} };
for (const [k] of TOGGLES) opt.on[k] = true;

function buildPath() {
  const p = new URLSearchParams();
  p.set('layout', opt.layout);
  p.set('theme', opt.theme);
  if (opt.motion === 'off') p.set('motion', 'off');
  if (opt.scale !== 100) p.set('renderScale', String(opt.scale));
  for (const [k] of TOGGLES) if (!opt.on[k]) p.set(k, '0');
  return `/overlay?${p.toString()}`;
}

function buildUrl() {
  return `${location.origin}${buildPath()}`;
}

const checkHost = $('optChecks');
for (const [k, label] of TOGGLES) {
  const wrap = document.createElement('label');
  wrap.className = 'check on';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = true;
  input.dataset.opt = k;
  input.addEventListener('change', () => {
    opt.on[k] = input.checked;
    wrap.classList.toggle('on', input.checked);
    sync();
  });
  wrap.appendChild(input);
  wrap.appendChild(document.createTextNode(label));
  checkHost.appendChild(wrap);
}

$('optLayout').addEventListener('change', (e) => { opt.layout = e.target.value; sync(); });
$('optTheme').addEventListener('change', (e) => { opt.theme = e.target.value; sync(); });
$('optMotion').addEventListener('change', (e) => { opt.motion = e.target.value; sync(); });
$('optScale').addEventListener('input', (e) => { opt.scale = Number(e.target.value); sync(); });

function sync() {
  $('optScaleVal').textContent = `${opt.scale}%`;
  const path = buildPath();
  $('overlayUrl').textContent = buildUrl();
  const frame = $('preview');
  if (frame && frame.getAttribute('src') !== path) frame.setAttribute('src', path);
  fitPreview();
}

// The preview iframe renders the overlay at a fixed 1340x620 viewport, then is
// scaled to fit whatever width the card has.
function fitPreview() {
  const host = document.querySelector('.preview-frame');
  const frame = $('preview');
  if (!host || !frame) return;
  frame.style.transform = `scale(${host.clientWidth / 1340})`;
}
window.addEventListener('resize', fitPreview);
window.addEventListener('load', fitPreview);

$('copyOverlay').addEventListener('click', async () => {
  const url = buildUrl();
  try {
    await navigator.clipboard.writeText(url);
    toast('OBS link copied');
  } catch {
    $('overlayUrl').textContent = url;
    toast('Copy blocked, select the URL below');
  }
});

let toastTimer = 0;
function toast(message) {
  let node = document.querySelector('.toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node.classList.remove('show'), 1800);
}

async function call(path, body) {
  const res = await fetch(`${path}${qs}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) toast(data?.error || `Request failed (${res.status})`);
  return data;
}

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    await call(`/api/session/${action}`);
    toast(action === 'refresh' ? 'Player refreshed' : `Session ${action}`);
  });
});

document.querySelectorAll('[data-demo]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    await call('/api/demo', { action: btn.dataset.demo });
  });
});
$('demoOn').addEventListener('click', async () => {
  await call('/api/demo', { enabled: true });
  toast('Demo mode on');
});
$('demoOff').addEventListener('click', async () => {
  await call('/api/demo', { enabled: false });
  toast('Returned to live');
});

function renderForm(form) {
  const list = Array.isArray(form) ? form.slice(-8) : [];
  const padded = [...Array(Math.max(0, 8 - list.length)).fill(''), ...list];
  const host = $('cForm');
  host.replaceChildren();
  padded.forEach((v) => {
    const chip = document.createElement('span');
    const key2 = v === 'W' ? 'win' : v === 'L' ? 'loss' : v === 'D' ? 'draw' : 'empty';
    chip.className = `cchip ${key2}`;
    chip.textContent = v || '';
    host.appendChild(chip);
  });
}

function render(state) {
  const pill = $('livePill');
  const connected = state?.ok;
  pill.className = 'live-pill';
  if (!connected) {
    pill.classList.add('off');
    $('liveLabel').textContent = state?.error ? 'error' : 'offline';
  } else if (state.source === 'demo') {
    pill.classList.add('demo');
    $('liveLabel').textContent = 'demo';
  } else {
    $('liveLabel').textContent = 'live';
  }

  if (!state?.ok) return;
  const rank = state.rank || {};
  $('cRankIcon').src = `/ranks/${rank.icon || 'Mythic.png'}`;
  $('cName').textContent = state.player?.name || '-';
  $('cRankName').textContent = rank.label ? rankLabel(rank.label) : '-';
  $('cElo').textContent = formatNumber(state.elo);
  $('cPeak').textContent = state.peak?.label ? `${rankLabel(state.peak.label)} · ${formatNumber(state.peak.elo)}` : '-';
  $('cSeasonPeak').textContent = state.seasonPeak?.label ? `${rankLabel(state.seasonPeak.label)} · ${formatNumber(state.seasonPeak.elo)}` : '-';
  $('cSource').textContent = state.source || '-';
  $('cRecord').textContent = `${state.session?.wins ?? 0}W · ${state.session?.losses ?? 0}L`;
  const kind = state.session?.streakType;
  const count = state.session?.currentStreak || 0;
  $('cStreak').textContent = count > 0 ? `${count} ${kind === 'win' ? 'win' : 'loss'}${count > 1 ? 's' : ''}` : '-';
  $('cChange').textContent = signed(state.session?.change);
  $('fetchedAt').textContent = state.fetchedAt ? new Date(state.fetchedAt).toLocaleTimeString() : '-';
  renderForm(state.form);
}

async function boot() {
  sync();
  try {
    render(await (await fetch('/api/state', { cache: 'no-store' })).json());
  } catch {
    render(null);
  }
  const source = new EventSource(`/api/stream${qs}`);
  source.onmessage = (event) => {
    try {
      render(JSON.parse(event.data));
    } catch {
      /* ignore */
    }
  };
  source.onerror = () => {
    $('livePill').className = 'live-pill off';
    $('liveLabel').textContent = 'offline';
  };
}

boot();
