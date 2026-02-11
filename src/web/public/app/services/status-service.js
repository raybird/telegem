export function createStatusService(api) {
  return {
    getHealth() {
      return api.request('/api/health');
    },
    getStatus() {
      return api.request('/api/status');
    }
  };
}
