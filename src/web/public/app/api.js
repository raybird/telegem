function parseJsonSafe(res) {
  return res.json().catch(() => ({}));
}

function parseSseEvent(eventText) {
  const lines = eventText.split('\n');
  let eventName = 'message';
  let dataText = '';
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataText += line.slice(5).trim();
    }
  }
  if (!dataText) {
    return null;
  }
  let payload = {};
  try {
    payload = JSON.parse(dataText);
  } catch {
    payload = {};
  }
  return { eventName, payload };
}

async function consumeSseResponse(res, handlers, signal) {
  const decoder = new TextDecoder('utf-8');
  const reader = res.body.getReader();
  let buffer = '';

  while (true) {
    if (signal?.aborted) {
      break;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let splitIndex = buffer.indexOf('\n\n');
    while (splitIndex !== -1) {
      const eventText = buffer.slice(0, splitIndex);
      buffer = buffer.slice(splitIndex + 2);
      const event = parseSseEvent(eventText);
      if (event && handlers && typeof handlers[event.eventName] === 'function') {
        handlers[event.eventName](event.payload);
      }
      splitIndex = buffer.indexOf('\n\n');
    }
  }
}

export function createApi(state) {
  async function request(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = state.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(path, { cache: 'no-store', ...options, headers });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  async function streamChat(message, handlers) {
    const headers = { 'Content-Type': 'application/json' };
    const token = state.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({ message })
    });

    if (!res.ok || !res.body) {
      const data = await parseJsonSafe(res);
      throw new Error(data.error || `Stream failed (${res.status})`);
    }

    await consumeSseResponse(res, handlers);
  }

  function openSse(path, handlers = {}) {
    const controller = new AbortController();
    const headers = {};
    const token = state.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    void (async () => {
      try {
        const res = await fetch(path, {
          method: 'GET',
          headers,
          signal: controller.signal
        });

        if (!res.ok || !res.body) {
          const data = await parseJsonSafe(res);
          throw new Error(data.error || `SSE failed (${res.status})`);
        }

        await consumeSseResponse(res, handlers, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (handlers && typeof handlers.error === 'function') {
          handlers.error({ error: error instanceof Error ? error.message : String(error) });
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }

  return {
    request,
    streamChat,
    openSse
  };
}
