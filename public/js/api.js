export async function loadState() {
  const res = await fetch('/api/state', { cache: 'no-store' });
  if (!res.ok) throw new Error(`state ${res.status}`);
  return res.json();
}

export function subscribe({ onState, onStatus }) {
  let source = null;
  let closed = false;

  function open() {
    if (closed) return;
    source = new EventSource('/api/stream');
    source.onopen = () => onStatus?.({ connected: true });
    source.onmessage = (event) => {
      try {
        onState(JSON.parse(event.data));
      } catch {
        /* ignore malformed frame */
      }
    };
    source.onerror = () => {
      onStatus?.({ connected: false });
      // EventSource reconnects on its own; nothing else to do.
    };
  }

  open();
  return () => {
    closed = true;
    source?.close();
  };
}