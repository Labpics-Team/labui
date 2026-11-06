/** Проверяет владельца фокуса по composed ancestry, включая именованные слоты. */
export function modalFocus(portal: Element): {
  inside: boolean;
  id: string;
  className: string;
  testId: string;
} {
  const content = portal.shadowRoot?.querySelector('.content');
  let active = portal.ownerDocument.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  let node: Node | null = active;
  let owner: Element | undefined;
  while (node) {
    if (node instanceof Element) {
      if (node.matches('.content[data-state="open"]')) {
        owner = node;
        break;
      }
      if (node.assignedSlot) {
        node = node.assignedSlot;
        continue;
      }
    }
    node = node instanceof ShadowRoot ? node.host : node.parentNode;
  }
  return {
    inside: !!content && owner === content,
    id: active?.id ?? '',
    className: active?.className ?? '',
    testId: active?.getAttribute('data-testid') ?? '',
  };
}
