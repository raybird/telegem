const ROUTES = new Set(['chat', 'memory', 'schedules', 'status']);

export function normalizeRouteFromHash(hash) {
  const raw = (hash || '').trim();
  const route = raw.replace(/^#\/?/, '').split('?')[0];
  if (!route) return 'chat';
  return ROUTES.has(route) ? route : 'chat';
}

export function ensureHashRoute() {
  if (!window.location.hash) {
    window.location.hash = '#/chat';
  }
}
