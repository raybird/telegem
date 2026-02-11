import { byId } from '../utils/dom.js';
import { toErrorMessage } from '../utils/format.js';
import { createViewScope } from '../utils/view.js';

export function mountChatView(container, ctx) {
  container.innerHTML = `
    <h2 class="title">Chat</h2>
    <div class="col">
      <div id="chatMessages" class="list" style="min-height: 320px;"></div>
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
  const tokenInput = byId(container, '#tokenInput');
  const saveTokenBtn = byId(container, '#saveTokenBtn');
  const status = byId(container, '#chatStatus');

  tokenInput.value = ctx.state.getToken();

  function addMessage(text, cls) {
    const div = document.createElement('div');
    div.className = 'item';
    div.style.background = cls === 'user' ? '#ecfeff' : '#fff7ed';
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendMessage() {
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    addMessage(text, 'user');
    status.textContent = 'Thinking...';

    let modelNode = null;
    const ensureModelNode = () => {
      if (modelNode) return modelNode;
      modelNode = document.createElement('div');
      modelNode.className = 'item';
      modelNode.style.background = '#fff7ed';
      messages.appendChild(modelNode);
      return modelNode;
    };

    try {
      await ctx.services.chat.streamMessage(text, {
        status(payload) {
          status.textContent = payload.text || 'Processing...';
        },
        chunk(payload) {
          const node = ensureModelNode();
          const chunk = payload.text || '';
          node.textContent = node.textContent ? `${node.textContent}\n\n${chunk}` : chunk;
          messages.scrollTop = messages.scrollHeight;
          status.textContent = 'Streaming...';
        },
        done(payload) {
          if (!modelNode) {
            const node = ensureModelNode();
            node.textContent = payload.reply || '(empty)';
          }
          status.textContent = 'Done';
        },
        error(payload) {
          status.textContent = payload.error || 'Stream error';
        }
      });
    } catch (error) {
      addMessage(`錯誤：${toErrorMessage(error)}`, 'model');
      status.textContent = 'Error';
    }
  }

  scope.on(sendBtn, 'click', () => scope.run(sendMessage));
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

  return () => scope.destroy();
}
