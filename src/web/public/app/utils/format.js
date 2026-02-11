export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatTimestamp(ts) {
  try {
    return new Date(ts).toLocaleString('zh-TW');
  } catch {
    return String(ts || '');
  }
}

export function parsePercent(raw) {
  if (typeof raw !== 'string') return null;
  const matched = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  if (!matched) return null;
  const value = Number.parseFloat(matched[1]);
  return Number.isFinite(value) ? value : null;
}

export function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error || 'Unknown error');
}
