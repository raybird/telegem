export function createScheduleService(api) {
  return {
    getAll() {
      return api.request('/api/schedules');
    },
    create(payload) {
      return api.request('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    update(id, payload) {
      return api.request(`/api/schedules/${encodeURIComponent(String(id))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    remove(id) {
      return api.request(`/api/schedules/${encodeURIComponent(String(id))}`, {
        method: 'DELETE'
      });
    },
    toggle(id, isActive) {
      return api.request('/api/schedules/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), isActive })
      });
    },
    reload() {
      return api.request('/api/schedules/reload', { method: 'POST' });
    },
    triggerReflect() {
      return api.request('/api/reflect', { method: 'POST' });
    }
  };
}
