import { byId } from '../utils/dom.js';
import { escapeHtml, formatTimestamp } from '../utils/format.js';
import { setListError } from '../utils/list.js';
import { createViewScope } from '../utils/view.js';

function renderEmptyState(container, text) {
  container.innerHTML = `<div class="item">${escapeHtml(text)}</div>`;
}

function formatMessageContent(text) {
  return escapeHtml(text || '').replace(/\n/g, '<br />');
}

function scrollToBottom(container) {
  container.scrollTop = container.scrollHeight;
}

function toConversationOrder(items) {
  if (!Array.isArray(items)) return [];
  if (items.length <= 1) return items;

  const firstTs = Number(items[0]?.timestamp || 0);
  const lastTs = Number(items[items.length - 1]?.timestamp || 0);

  if (firstTs > lastTs) {
    return [...items].reverse();
  }
  return items;
}

function renderMessageList(container, items) {
  container.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    renderEmptyState(container, '(none)');
    return;
  }

  const orderedItems = toConversationOrder(items);

  for (const item of orderedItems) {
    const role = String(item.role || 'unknown').toLowerCase();
    const isUser = role === 'user';
    const row = document.createElement('div');
    row.className = `memory-chat-row ${isUser ? 'user' : 'model'}`;
    row.innerHTML = `
      <div class="memory-chat-bubble ${isUser ? 'user' : 'model'}">
        <div class="memory-chat-meta">${escapeHtml(role)} | ${escapeHtml(formatTimestamp(item.timestamp))}</div>
        <div class="memory-chat-content">${formatMessageContent(item.content)}</div>
      </div>
    `;
    container.appendChild(row);
  }

  scrollToBottom(container);
}

export function mountMemoryView(container, ctx) {
  const scope = createViewScope();
  container.innerHTML = `
    <h2 class="title">Memory</h2>
    <section class="col">
      <div class="row">
        <strong>Search</strong>
        <input id="searchInput" style="flex:1;" placeholder="關鍵字" />
        <button id="searchBtn">搜尋</button>
      </div>
      <div id="searchList" class="list memory-chat-list"></div>
    </section>

    <section class="col" style="margin-top:12px;">
      <div class="row">
        <strong>History</strong>
        <button id="prevPageBtn">上一頁</button>
        <button id="nextPageBtn">下一頁</button>
        <span id="pageInfo" class="muted"></span>
        <span style="flex:1;"></span>
        <button id="exportJsonBtn">匯出 JSON</button>
        <button id="exportCsvBtn">匯出 CSV</button>
      </div>
      <div id="historyList" class="list memory-chat-list"></div>
    </section>
  `;

  const searchInput = byId(container, '#searchInput');
  const searchList = byId(container, '#searchList');
  const historyList = byId(container, '#historyList');
  const pageInfo = byId(container, '#pageInfo');

  const searchBtn = byId(container, '#searchBtn');
  const prevPageBtn = byId(container, '#prevPageBtn');
  const nextPageBtn = byId(container, '#nextPageBtn');
  const exportJsonBtn = byId(container, '#exportJsonBtn');
  const exportCsvBtn = byId(container, '#exportCsvBtn');

  let offset = 0;
  const limit = 12;

  async function doSearch() {
    const q = (searchInput.value || '').trim();
    if (!q) {
      renderEmptyState(searchList, '請輸入關鍵字');
      return;
    }
    const data = await ctx.services.memory.search(q, 20);
    renderMessageList(searchList, data.items || []);
  }

  async function loadHistory() {
    const data = await ctx.services.memory.getHistory(offset, limit);
    renderMessageList(historyList, data.items || []);
    const total = Number(data.total || 0);
    const page = Math.floor(offset / limit) + 1;
    const pages = Math.max(1, Math.ceil(total / limit));
    pageInfo.textContent = `page ${page}/${pages} total ${total}`;
    prevPageBtn.disabled = offset <= 0;
    nextPageBtn.disabled = !(data.hasMore === true);
  }

  function exportMemory(format) {
    window.open(ctx.services.memory.exportUrl(format), '_blank');
  }

  const onSearch = () => void doSearch().catch((e) => setListError(searchList, e));
  const onPrev = () => {
    offset = Math.max(0, offset - limit);
    void loadHistory().catch((e) => setListError(historyList, e));
  };
  const onNext = () => {
    offset += limit;
    void loadHistory().catch((e) => setListError(historyList, e));
  };
  const onSearchEnter = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void onSearch();
    }
  };

  scope.on(searchBtn, 'click', onSearch);
  scope.on(prevPageBtn, 'click', onPrev);
  scope.on(nextPageBtn, 'click', onNext);
  scope.on(exportJsonBtn, 'click', () => exportMemory('json'));
  scope.on(exportCsvBtn, 'click', () => exportMemory('csv'));
  scope.on(searchInput, 'keydown', onSearchEnter);

  renderEmptyState(searchList, '請輸入關鍵字');
  void loadHistory();

  return () => scope.destroy();
}
