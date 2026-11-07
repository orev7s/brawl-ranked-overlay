// Overlay themes. "brawl-default" has no fixed palette: it takes its colours
// from the player's rank (Mythic purple, Diamond blue, Masters dark red, Pro
// gold, and so on). The others use a fixed accent.
const THEMES = {
  'gold-rush': {
    accent: '#a16f00', edge: '#ffe77f', deep: '#4a3200',
    plate: '#ffe77f', plateDeep: '#c48f00', plateInk: '#3a2600',
    ribbon: '#ffc93c', ribbonDeep: '#a16f00',
    panel: '#2a2210', panelDeep: '#120e06',
  },
  midnight: {
    accent: '#1a2444', edge: '#7cc5ff', deep: '#0c1428',
    plate: '#8ccbff', plateDeep: '#2b6cc4', plateInk: '#062040',
    ribbon: '#2b8cff', ribbonDeep: '#123a8a',
    panel: '#141d38', panelDeep: '#070b16',
  },
  frost: {
    accent: '#318ea2', edge: '#bdf2ff', deep: '#0d3a46',
    plate: '#cdeeff', plateDeep: '#4aa6ba', plateInk: '#06323c',
    ribbon: '#59d4ec', ribbonDeep: '#1c6f80',
    panel: '#152730', panelDeep: '#081117',
  },
};

export const THEME_KEYS = ['brawl-default', 'midnight', 'gold-rush', 'frost'];

export function isTheme(key) {
  return THEME_KEYS.includes(key);
}

// Applies the theme variables to the widget. For brawl-default, `rank` supplies
// the accent so the widget matches the emblem.
export function applyTheme(widget, themeKey, rank) {
  const key = isTheme(themeKey) ? themeKey : 'brawl-default';
  widget.dataset.theme = key;

  // brawl-default takes its colours from the player's rank, so the ribbon and
  // title shift with the emblem (Mythic pink, Diamond blue, Pro gold-on-slate,
  // and so on). The name tag keeps the fixed gold plate.
  const theme = THEMES[key] || {
    accent: rank?.color || '#c3147f',
    edge: rank?.edge || '#ff77ab',
    deep: rank?.deep || '#6c0243',
    plate: '#ffd23f', plateDeep: '#f0a10c', plateInk: '#2a1a00',
    ribbon: rank?.color || '#ff3f97', ribbonDeep: rank?.deep || '#ba005c',
    panel: '#182742', panelDeep: '#0a1120',
  };

  const set = (name, value) => widget.style.setProperty(name, value);
  set('--accent', theme.accent);
  set('--accent-edge', theme.edge);
  set('--accent-deep', theme.deep);
  set('--plate-1', theme.plate);
  set('--plate-2', theme.plateDeep);
  set('--plate-ink', theme.plateInk);
  set('--ribbon-1', theme.ribbon);
  set('--ribbon-2', theme.ribbonDeep);
  set('--panel-1', theme.panel);
  set('--panel-2', theme.panelDeep);
}
