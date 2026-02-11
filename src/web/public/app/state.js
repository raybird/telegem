const STORAGE_TOKEN_KEY = 'telenexus_web_token';

export function createState(config = {}) {
  const state = {
    route: 'chat',
    token: window.localStorage.getItem(STORAGE_TOKEN_KEY) || '',
    health: { online: false, updatedAt: 0 },
    config: {
      errorThreshold: Number.isFinite(config.alertErrorThreshold)
        ? Number(config.alertErrorThreshold)
        : 1,
      runnerWarnThreshold: Number.isFinite(config.alertRunnerSuccessWarnThreshold)
        ? Number(config.alertRunnerSuccessWarnThreshold)
        : 80
    }
  };

  return {
    get() {
      return state;
    },
    setRoute(route) {
      state.route = route;
    },
    setToken(token) {
      state.token = token.trim();
      if (state.token) {
        window.localStorage.setItem(STORAGE_TOKEN_KEY, state.token);
      } else {
        window.localStorage.removeItem(STORAGE_TOKEN_KEY);
      }
    },
    getToken() {
      return state.token;
    },
    setHealth(online) {
      state.health.online = online;
      state.health.updatedAt = Date.now();
    }
  };
}
