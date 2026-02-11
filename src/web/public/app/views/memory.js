import { byId } from '../utils/dom.js';
import { escapeHtml, formatTimestamp } from '../utils/format.js';
import { renderList, setListError } from '../utils/list.js';
import { createViewScope } from '../utils/view.js';

function renderMessageList(container, items) {
  renderList(
    container,
    items,
    (item) =>
      `<div class="muted">${item.role} | ${formatTimestamp(item.timestamp)}</div><div>${escapeHtml(item.content || '')}</div>`
  );
}

export function mountMemoryView(container, ctx) {
  const scope = createViewScope();
  container.innerHTML = `
    <h2 class="title">Memory</h2>
    <div class="grid-2">
      <section class="col">
        <div class="row">
          <strong>Recent</strong>
          <button id="refreshRecentBtn">刷新</button>
        </div>
        <div id="recentList" class="list"></div>
      </section>
      <section class="col">
        <div class="row">
          <strong>Search</strong>
          <input id="searchInput" style="flex:1;" placeholder="關鍵字" />
          <button id="searchBtn">搜尋</button>
        </div>
        <div id="searchList" class="list"></div>
      </section>
    </div>

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
      <div id="historyList" class="list"></div>
    </section>
  `;

  const recentList = byId(container, '#recentList');
  const searchInput = byId(container, '#searchInput');
  const searchList = byId(container, '#searchList');
  const historyList = byId(container, '#historyList');
  const pageInfo = byId(container, '#pageInfo');

  const refreshRecentBtn = byId(container, '#refreshRecentBtn');
  const searchBtn = byId(container, '#searchBtn');
  const prevPageBtn = byId(container, '#prevPageBtn');
  const nextPageBtn = byId(container, '#nextPageBtn');
  const exportJsonBtn = byId(container, '#exportJsonBtn');
  const exportCsvBtn = byId(container, '#exportCsvBtn');

  let offset = 0;
  const limit = 12;

  async function loadRecent() {
    const data = await ctx.services.memory.getRecent(12);
    renderMessageList(recentList, data.items || []);
  }

  async function doSearch() {
    const q = (searchInput.value || '').trim();
    if (!q) {
      renderList(searchList, [], () => '', { emptyText: '請輸入關鍵字' });
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

  const onRefresh = () => void loadRecent().catch((e) => setListError(recentList, e));
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

  scope.on(refreshRecentBtn, 'click', onRefresh);
  scope.on(searchBtn, 'click', onSearch);
  scope.on(prevPageBtn, 'click', onPrev);
  scope.on(nextPageBtn, 'click', onNext);
  scope.on(exportJsonBtn, 'click', () => exportMemory('json'));
  scope.on(exportCsvBtn, 'click', () => exportMemory('csv'));
  scope.on(searchInput, 'keydown', onSearchEnter);

  void loadRecent();
  void loadHistory();

  return () => scope.destroy();
}
