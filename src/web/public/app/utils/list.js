export function renderList(container, items, renderItem, options = {}) {
  const emptyText = options.emptyText || '(none)';
  container.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = `<div class="item">${emptyText}</div>`;
    return;
  }

  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = renderItem(item);
    container.appendChild(div);
  }
}

export function setListError(container, error) {
  const message = error instanceof Error ? error.message : String(error);
  container.innerHTML = `<div class="item">${message}</div>`;
}
