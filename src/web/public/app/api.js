function parseJsonSafe(res) {
  return res.json().catch(() => ({}));
}

export function createApi(state) {
  async function request(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = state.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(path, { ...options, headers });
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

    const decoder = new TextDecoder('utf-8');
    const reader = res.body.getReader();
    let buffer = '';

    const emit = (eventText) => {
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
      if (!dataText) return;
      let payload = {};
      try {
        payload = JSON.parse(dataText);
      } catch {
        payload = {};
      }
      if (handlers && typeof handlers[eventName] === 'function') {
        handlers[eventName](payload);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let splitIndex = buffer.indexOf('\n\n');
      while (splitIndex !== -1) {
        const eventText = buffer.slice(0, splitIndex);
        buffer = buffer.slice(splitIndex + 2);
        emit(eventText);
        splitIndex = buffer.indexOf('\n\n');
      }
    }
  }

  return {
    request,
    streamChat
  };
}
