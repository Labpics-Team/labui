import { isFocusable } from '@zag-js/dom-query';

/** DOM-контекст владельца; функции не создают отдельного focus runtime. */
export interface DialogFocusContext {
  readonly owner: HTMLElement | null;
  readonly content: Element | null;
  readonly trigger: HTMLElement | null;
}

// TypeScript 5.7 lib.dom ещё не содержит стандартную ARIA element reflection.
// Этот узкий interop проверяется capability и readback, а не приведением типа.
type AriaControlsElement = Element & {
  ariaControlsElements: readonly Element[] | null;
};

function hasAriaControlsElements(element: Element): element is AriaControlsElement {
  return 'ariaControlsElements' in element;
}

/** Связь с доступным controlled container; cleanup возвращает прежнее отношение. */
export function bindDialogTriggerControls(
  trigger: HTMLButtonElement,
  controlled: HTMLElement,
): () => void {
  const previousAttribute = trigger.getAttribute('aria-controls');
  const previousReferences = hasAriaControlsElements(trigger) ? trigger.ariaControlsElements : null;
  const restore = (): void => {
    if (hasAriaControlsElements(trigger) && !previousAttribute && previousReferences?.length) {
      trigger.ariaControlsElements = previousReferences;
    } else if (previousAttribute === null) {
      trigger.removeAttribute('aria-controls');
    } else {
      trigger.setAttribute('aria-controls', previousAttribute);
    }
  };

  const root = trigger.getRootNode();
  if (root === controlled.getRootNode() && controlled.id) {
    if (
      !(root instanceof Document || root instanceof ShadowRoot) ||
      root.getElementById(controlled.id) !== controlled
    ) {
      throw new TypeError(
        'LabModal: controlled container id does not resolve in the trigger root.',
      );
    }
    trigger.setAttribute('aria-controls', controlled.id);
  } else {
    if (!hasAriaControlsElements(trigger)) {
      throw new TypeError('LabModal: this trigger requires Element.ariaControlsElements support.');
    }
    trigger.ariaControlsElements = [controlled];
  }
  if (hasAriaControlsElements(trigger) && !trigger.ariaControlsElements?.includes(controlled)) {
    restore();
    throw new TypeError('LabModal: controlled container is outside the trigger reference scope.');
  }
  return restore;
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
  return context.owner?.isConnected && trigger?.isConnected && isFocusable(trigger)
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
