export function createViewScope() {
  const cleanups = [];

  return {
    on(target, eventName, handler, options) {
      target.addEventListener(eventName, handler, options);
      cleanups.push(() => target.removeEventListener(eventName, handler, options));
      return handler;
    },
    run(task, onError) {
      void Promise.resolve()
        .then(task)
        .catch((error) => {
          if (typeof onError === 'function') {
            onError(error);
          }
        });
    },
    destroy() {
      while (cleanups.length > 0) {
        const cleanup = cleanups.pop();
        cleanup();
      }
    }
  };
}
