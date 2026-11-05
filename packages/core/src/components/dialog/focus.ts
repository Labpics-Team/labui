/** DOM-контекст владельца; функции не создают отдельного focus runtime. */
export interface DialogFocusContext {
  readonly owner: HTMLElement | null;
  readonly content: Element | null;
  readonly trigger: HTMLElement | null;
}

export function composedAncestors(element: Element | null): Element[] {
  const ancestors: Element[] = [];
  let node: Node | null = element;
  while (node) {
    if (node instanceof Element) {
      ancestors.push(node);
      if (node.assignedSlot) {
        node = node.assignedSlot;
        continue;
      }
    }
    node = node instanceof ShadowRoot ? node.host : node.parentNode;
  }
  return ancestors;
}

function modalFocus(
  context: DialogFocusContext,
): { active: HTMLElement; content: Element } | undefined {
  const document =
    context.owner?.ownerDocument ??
    context.content?.ownerDocument ??
    context.trigger?.ownerDocument;
  if (!document) return;
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  if (!(active instanceof HTMLElement)) return;
  const content = composedAncestors(active).find((node) =>
    node.matches('[data-scope="dialog"][data-part="content"][data-state="open"]'),
  );
  if (content) return { active, content };
}

function isIndependentModal(context: DialogFocusContext, content: Element): boolean {
  return content !== context.content && !composedAncestors(context.owner).includes(content);
}

export function dialogFinalFocusTarget(context: DialogFocusContext): HTMLElement | null {
  const focus = modalFocus(context);
  // Поздний cleanup сохраняет самостоятельный новый modal. Родитель остаётся
  // допустимым местом возврата: его прежний Sheet trigger снова доступен.
  if (focus && isIndependentModal(context, focus.content)) return focus.active;
  const trigger = context.trigger;
  return context.owner?.isConnected &&
    trigger?.isConnected &&
    !trigger.matches(':disabled') &&
    !trigger.closest('[inert]')
    ? trigger
    : null;
}

export function completeFailedDialogFocus(context: DialogFocusContext): void {
  if (!context.owner?.isConnected) return;
  const focus = modalFocus(context);
  if (focus && isIndependentModal(context, focus.content)) return;
  // trapFocus создаёт trap на RAF. Ранний отказ отменяет его до активации,
  // поэтому уже заданная точка finalFocus завершается здесь, до callback.
  dialogFinalFocusTarget(context)?.focus({ preventScroll: true });
}
