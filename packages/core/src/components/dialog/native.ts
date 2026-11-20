import { isFocusable } from '@zag-js/dom-query';
import { composedAncestors } from './focus.js';

export interface NativeDialogOptions {
  content(): HTMLElement | null;
  trigger(): HTMLElement | null;
  initialFocus?(): HTMLElement | null;
  dismissOnOutside?(): boolean;
  onDismiss(): void;
}

export interface NativeDialog {
  update(present: boolean, modal: boolean, open: boolean): void;
  dispose(): void;
}

const scrollLocks = new WeakMap<Document, { count: number; value: string; priority: string }>();
interface DialogBoundary {
  dialog: HTMLDialogElement;
  closeFromAncestor(): void;
}
const dialogBoundaries = new WeakMap<Document, Set<DialogBoundary>>();

function lockScroll(document: Document): () => void {
  const style = document.documentElement.style;
  let lock = scrollLocks.get(document);
  if (!lock) {
    lock = {
      count: 0,
      value: style.getPropertyValue('overflow'),
      priority: style.getPropertyPriority('overflow'),
    };
    scrollLocks.set(document, lock);
    style.setProperty('overflow', 'hidden');
  }
  lock.count++;
  return () => {
    if (--lock.count > 0) return;
    scrollLocks.delete(document);
    if (style.getPropertyValue('overflow') !== 'hidden') return;
    if (lock.value) style.setProperty('overflow', lock.value, lock.priority);
    else style.removeProperty('overflow');
  };
}

/** Native top layer сохраняет CSS/слоты; exit завершается до снятия модальности. */
export function mountNativeDialog(
  dialog: HTMLDialogElement,
  options: NativeDialogOptions,
): NativeDialog {
  let disposed = false;
  let currentModal = true;
  let closingEvents = 0;
  let externallyClosed = false;
  let requestedOpen = false;
  let unlock: (() => void) | undefined;
  let outsidePointer: number | undefined;
  let composing = false;
  let composingEscape = false;
  const listeners = new AbortController();
  const eventOptions = { signal: listeners.signal };
  const boundaries = dialogBoundaries.get(dialog.ownerDocument) ?? new Set<DialogBoundary>();
  dialogBoundaries.set(dialog.ownerDocument, boundaries);
  const boundary: DialogBoundary = {
    dialog,
    closeFromAncestor() {
      externallyClosed = true;
      close(false);
      options.onDismiss();
    },
  };
  boundaries.add(boundary);
  const closeDescendants = (): void => {
    // Native top-layer membership survives hiding an ancestor. Close nested
    // boundaries before that branch disappears, including through slots.
    for (const child of boundaries) {
      if (
        child !== boundary &&
        child.dialog.open &&
        composedAncestors(child.dialog).includes(dialog)
      )
        child.closeFromAncestor();
    }
  };
  const activeElement = (): Element | null => {
    let element = dialog.ownerDocument.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element;
  };
  const shouldRestoreFocus = (): boolean => {
    const active = activeElement();
    const ancestors = composedAncestors(active);
    if (!currentModal) {
      return ancestors.includes(dialog) || !active || active === dialog.ownerDocument.body;
    }
    if (ancestors.includes(dialog)) return true;
    // Закрытие старого modal не перехватывает фокус самостоятельного нового.
    const parents = composedAncestors(dialog);
    return !ancestors.some(
      (element) =>
        element !== dialog && !parents.includes(element) && element.matches('dialog:modal'),
    );
  };
  const isOutside = (event: Event): boolean => {
    const content = options.content();
    return !!content && !event.composedPath().includes(content);
  };
  const dismiss = (): void => {
    if (!disposed && dialog.open) options.onDismiss();
  };
  dialog.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      const fromComposition = composing || composingEscape;
      composingEscape = false;
      if (!fromComposition) dismiss();
    },
    eventOptions,
  );
  dialog.addEventListener(
    'compositionstart',
    () => {
      composing = true;
    },
    eventOptions,
  );
  dialog.addEventListener(
    'compositionend',
    () => {
      composing = false;
    },
    eventOptions,
  );
  // WebKit can issue a native cancel as the default action of a composing
  // Escape, deferred beyond timers. Leave the IME key untouched and consume
  // only that close request; the next user interaction replaces this intent.
  // Non-modal popovers do not receive the native dialog cancel event.
  dialog.addEventListener(
    'keydown',
    (event) => {
      composingEscape =
        event.key === 'Escape' && (composing || event.isComposing || event.keyCode === 229);
      if (event.key !== 'Escape') return;
      if (!currentModal && !event.defaultPrevented && !composingEscape) {
        event.preventDefault();
        dismiss();
      }
    },
    eventOptions,
  );
  dialog.ownerDocument.addEventListener(
    'pointerdown',
    (event) => {
      composingEscape = false;
      if (!dialog.open || (currentModal && !event.composedPath().includes(dialog))) return;
      const trigger = options.trigger();
      outsidePointer =
        event.isPrimary &&
        event.button === 0 &&
        isOutside(event) &&
        (!trigger || !event.composedPath().includes(trigger))
          ? event.pointerId
          : undefined;
    },
    eventOptions,
  );
  dialog.ownerDocument.addEventListener(
    'pointerup',
    (event) => {
      const outside = event.pointerId === outsidePointer && isOutside(event);
      outsidePointer = undefined;
      if (outside && options.dismissOnOutside?.() !== false) dismiss();
    },
    eventOptions,
  );
  dialog.addEventListener(
    'pointercancel',
    () => {
      outsidePointer = undefined;
    },
    eventOptions,
  );
  dialog.addEventListener(
    'close',
    () => {
      if (closingEvents) {
        closingEvents--;
        return;
      }
      // form method="dialog" and close() are also observable state changes.
      if (!disposed && !dialog.open) {
        externallyClosed = true;
        closeDescendants();
        unlock?.();
        unlock = undefined;
        const trigger = options.trigger();
        if (shouldRestoreFocus() && trigger?.isConnected && isFocusable(trigger))
          trigger.focus({ preventScroll: true });
        options.onDismiss();
      }
    },
    eventOptions,
  );

  function close(restore: boolean): void {
    composingEscape = false;
    composing = false;
    const wasPresent = dialog.open || !!unlock;
    const restoreFocus = shouldRestoreFocus();
    closeDescendants();
    if (dialog.open) {
      if (dialog.matches(':popover-open')) dialog.hidePopover();
      closingEvents++;
      dialog.close();
    }
    unlock?.();
    unlock = undefined;
    const trigger = options.trigger();
    if (restore && wasPresent && restoreFocus && trigger?.isConnected && isFocusable(trigger))
      trigger.focus({ preventScroll: true });
  }

  return {
    update(present, modal, open) {
      if (disposed) return;
      if (open && !requestedOpen) externallyClosed = false;
      requestedOpen = open;
      if (dialog.open && modal !== currentModal) close(false);
      currentModal = modal;
      if (!present) {
        externallyClosed = false;
        close(true);
        return;
      }
      if (externallyClosed || dialog.open || !dialog.isConnected) return;
      if (modal) {
        dialog.removeAttribute('popover');
        dialog.showModal();
        unlock = lockScroll(dialog.ownerDocument);
      } else {
        dialog.popover = 'manual';
        dialog.show();
        dialog.showPopover();
      }
      options.initialFocus?.()?.focus({ preventScroll: true });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.abort();
      close(dialog.isConnected);
      boundaries.delete(boundary);
      unlock?.();
      unlock = undefined;
    },
  };
}
