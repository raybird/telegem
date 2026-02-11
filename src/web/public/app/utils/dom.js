export function byId(container, selector) {
  const node = container.querySelector(selector);
  if (!node) {
    throw new Error(`Missing DOM node: ${selector}`);
  }
  return node;
}

export function setText(node, text) {
  node.textContent = String(text || '');
}
