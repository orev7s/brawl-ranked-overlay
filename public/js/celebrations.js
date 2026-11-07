import { elements } from './render.js';

const RIBBONS = {
  win: {
    text: 'VICTORY!',
    duration: 1700,
    confetti: true,
    shine: false,
    panel: 'pulse',
    sub: (o) => (Number.isFinite(o.delta) && o.delta !== 0 ? `${o.delta > 0 ? '+' : ''}${o.delta} ELO` : 'RANKED WIN'),
  },
  loss: {
    text: 'DEFEAT',
    duration: 1500,
    confetti: false,
    shine: false,
    panel: 'shake',
    sub: (o) => (Number.isFinite(o.delta) && o.delta !== 0 ? `${o.delta > 0 ? '+' : ''}${o.delta} ELO` : 'RANKED LOSS'),
  },
  rankup: {
    text: 'RANK UP!',
    duration: 2900,
    confetti: true,
    shine: true,
    panel: 'pulse',
    sub: (o) => (o.from && o.to ? `${o.from}  ▶  ${o.to}` : ''),
  },
  rankdown: {
    text: 'RANK DOWN',
    duration: 2100,
    confetti: false,
    shine: false,
    panel: 'shake',
    sub: (o) => (o.from && o.to ? `${o.from}  ▶  ${o.to}` : ''),
  },
};

const PALETTE = {
  win: ['#5bf07e', '#b8ffcb', '#ffffff', '#ffd23f', '#2fd05c'],
  rankup: ['#ffe07a', '#ffb347', '#ffffff', '#ffd23f', '#ff8a00'],
};

let current = null;
let confettiTimer = 0;

function clearCurrent() {
  if (!current) return;
  current.timers.forEach((t) => clearTimeout(t));
  current.ribbon.remove();
  current = null;
}

function spawnConfetti(kind) {
  const el = elements();
  if (el.widget.dataset.motion === 'off') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = PALETTE[kind];
  if (!colors) return;
  const layer = el.confetti;
  clearTimeout(confettiTimer);
  layer.replaceChildren();
  for (let i = 0; i < 28; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'piece';
    const round = Math.random() > 0.6;
    piece.style.left = `${3 + Math.random() * 94}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.width = `${7 + Math.random() * 7}px`;
    piece.style.height = `${9 + Math.random() * 10}px`;
    piece.style.borderRadius = round ? '50%' : '3px';
    piece.style.animationDuration = `${1.1 + Math.random() * 0.8}s`;
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    layer.appendChild(piece);
  }
  confettiTimer = window.setTimeout(() => layer.replaceChildren(), 2400);
}

export function play(kind, opts = {}) {
  const cfg = RIBBONS[kind];
  if (!cfg) return;
  const el = elements();
  clearCurrent();

  const ribbon = document.createElement('div');
  ribbon.className = `ribbon ${kind}`;

  const text = document.createElement('span');
  text.className = 'ribbon-text';
  text.textContent = cfg.text;
  ribbon.appendChild(text);

  const subText = cfg.sub ? cfg.sub(opts) : '';
  if (subText) {
    const sub = document.createElement('span');
    sub.className = 'ribbon-sub';
    sub.textContent = subText;
    ribbon.appendChild(sub);
  }

  el.celebration.replaceChildren(ribbon);
  if (cfg.shine) requestAnimationFrame(() => ribbon.classList.add('shine'));
  if (cfg.confetti) spawnConfetti(kind);

  if (cfg.panel) {
    el.panel.classList.remove('shake', 'pulse');
    void el.panel.offsetWidth;
    el.panel.classList.add(cfg.panel);
  }

  const leaveAt = Math.max(300, cfg.duration - 360);
  const timers = [
    window.setTimeout(() => ribbon.classList.add('leaving'), leaveAt),
    window.setTimeout(() => {
      ribbon.remove();
      el.celebration.replaceChildren();
      el.panel.classList.remove('shake', 'pulse');
      current = null;
    }, cfg.duration),
  ];
  current = { ribbon, timers };
}

export function stop() {
  clearCurrent();
  const el = elements();
  el.celebration.replaceChildren();
  el.panel.classList.remove('shake', 'pulse');
  clearTimeout(confettiTimer);
  el.confetti.replaceChildren();
}