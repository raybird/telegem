import { byId } from '../utils/dom.js';
import { escapeHtml, formatTimestamp, toErrorMessage } from '../utils/format.js';
import { createViewScope } from '../utils/view.js';

function formatMessageContent(text) {
  return escapeHtml(text || '').replace(/\n/g, '<br />');
}

function scrollToBottom(container) {
  container.scrollTop = container.scrollHeight;
}

export function mountChatView(container, ctx) {
  container.innerHTML = `
    <h2 class="title">Chat</h2>
    <div class="col">
      <div class="row">
        <strong>Recent Context</strong>
        <span class="muted" style="flex:1;">已自動載入最近記憶訊息</span>
        <button id="reloadRecentBtn">重載 Recent</button>
      </div>
      <div id="chatMessages" class="list memory-chat-list" style="min-height: 320px;"></div>
      <div class="row">
        <input id="chatInput" style="flex:1;" placeholder="輸入訊息..." autocomplete="off" />
        <button id="chatSendBtn">送出</button>
      </div>
      <div class="row">
        <input id="tokenInput" style="flex:1;" placeholder="API token（可留白）" autocomplete="off" />
        <button id="saveTokenBtn">儲存 Token</button>
      </div>
      <div class="muted" id="chatStatus">Ready</div>
    </div>
  `;

  const scope = createViewScope();
  const messages = byId(container, '#chatMessages');
  const input = byId(container, '#chatInput');
  const sendBtn = byId(container, '#chatSendBtn');
  const reloadRecentBtn = byId(container, '#reloadRecentBtn');
  const tokenInput = byId(container, '#tokenInput');
  const saveTokenBtn = byId(container, '#saveTokenBtn');
  const status = byId(container, '#chatStatus');

  tokenInput.value = ctx.state.getToken();

  function clearMessages() {
    messages.innerHTML = '';
  }

  function addMessageBubble(role, content, metaText) {
    const isUser = role === 'user';
    const row = document.createElement('div');
    row.className = `memory-chat-row ${isUser ? 'user' : 'model'}`;
    row.innerHTML = `
      <div class="memory-chat-bubble ${isUser ? 'user' : 'model'}">
        <div class="memory-chat-meta">${escapeHtml(metaText)}</div>
        <div class="memory-chat-content">${formatMessageContent(content)}</div>
      </div>
    `;
    messages.appendChild(row);
    scrollToBottom(messages);
    const contentNode = row.querySelector('.memory-chat-content');
    return contentNode instanceof HTMLElement ? contentNode : null;
  }

  async function loadRecentMessages() {
    status.textContent = 'Loading recent...';
    const data = await ctx.services.memory.getRecent(30);
    const items = Array.isArray(data.items) ? [...data.items] : [];
    if (items.length === 0) {
      clearMessages();
      status.textContent = 'Ready';
      return;
    }

    const firstTs = Number(items[0]?.timestamp || 0);
    const lastTs = Number(items[items.length - 1]?.timestamp || 0);
    if (firstTs > lastTs) {
      items.reverse();
    }

    clearMessages();
    for (const item of items) {
      const role = item.role === 'user' ? 'user' : 'model';
      const stamp = formatTimestamp(item.timestamp);
      addMessageBubble(role, item.content || '', `${role} | ${stamp}`);
    }
    status.textContent = 'Ready';
  }

  async function sendMessage() {
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    addMessageBubble('user', text, `user | ${formatTimestamp(Date.now())}`);
    status.textContent = 'Thinking...';

    let modelContentNode = null;
    let modelBuffer = '';
    const ensureModelNode = () => {
      if (modelContentNode) return modelContentNode;
      modelContentNode = addMessageBubble('model', '', 'model | streaming');
      return modelContentNode;
    };

    try {
      await ctx.services.chat.streamMessage(text, {
        status(payload) {
          status.textContent = payload.text || 'Processing...';
        },
        chunk(payload) {
          const contentNode = ensureModelNode();
          const chunk = payload.text || '';
          modelBuffer = modelBuffer ? `${modelBuffer}\n\n${chunk}` : chunk;
          if (contentNode) {
            contentNode.innerHTML = formatMessageContent(modelBuffer);
          }
          scrollToBottom(messages);
          status.textContent = 'Streaming...';
        },
        done(payload) {
          if (!modelContentNode) {
            const contentNode = ensureModelNode();
            const reply = payload.reply || '(empty)';
            modelBuffer = reply;
            if (contentNode) {
              contentNode.innerHTML = formatMessageContent(reply);
            }
          }
          scrollToBottom(messages);
          status.textContent = 'Done';
        },
        error(payload) {
          status.textContent = payload.error || 'Stream error';
        }
      });
    } catch (error) {
      addMessageBubble(
        'model',
        `錯誤：${toErrorMessage(error)}`,
        `model | ${formatTimestamp(Date.now())}`
      );
      status.textContent = 'Error';
    }
  }

  scope.on(sendBtn, 'click', () => scope.run(sendMessage));
  scope.on(reloadRecentBtn, 'click', () =>
    scope.run(async () => {
      try {
        await loadRecentMessages();
      } catch (error) {
        status.textContent = `Error: ${toErrorMessage(error)}`;
      }
    })
  );
  scope.on(input, 'keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      scope.run(sendMessage);
    }
  });
  scope.on(saveTokenBtn, 'click', () => {
    ctx.state.setToken(tokenInput.value || '');
    status.textContent = 'Token saved';
  });
  scope.on(container, 'view:show', () => {
    scope.run(async () => {
      try {
        await loadRecentMessages();
      } catch (error) {
        status.textContent = `Error: ${toErrorMessage(error)}`;
      }
    });
  });

  void scope.run(loadRecentMessages);

  return () => scope.destroy();
}
