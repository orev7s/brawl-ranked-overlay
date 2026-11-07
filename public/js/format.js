const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function titleCase(value) {
  if (!value) return '';
  return String(value)
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (/^[IVXLCDM]+$/i.test(word) && /^[IVXLCDM]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

export function signed(value) {
  if (!Number.isFinite(value)) return '±0';
  if (value === 0) return '±0';
  return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value))}`;
}

export function rankLabel(name) {
  return titleCase(String(name || '').replace(/\s+/g, ' ').trim());
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${time}`;
}