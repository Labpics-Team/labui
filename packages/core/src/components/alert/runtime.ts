import { mountMaterialRuntime } from '@labpics/ui-materials';
import { alertProfile } from '@labpics/ui-tokens';

export interface AlertRuntimeOptions {
  readonly open: boolean;
  readonly heading: string;
  readonly description: string;
  readonly notificationKey?: string | number;
}

/** One announcement per message, no timer, polling, or global keyboard handler. */
export function mountAlertRuntime(
  panel: HTMLElement,
  announcement: HTMLElement,
  size: (px: number) => void,
) {
  let disposeMaterial: (() => void) | undefined;
  let previous: AlertRuntimeOptions | undefined;
  let generation = 0;
  let disposed = false;
  const doc = panel.ownerDocument;
  let returnTarget = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
  let hadFocus = false;
  const focusIn = (event: FocusEvent) => {
    if (
      !panel.contains(event.relatedTarget as Node | null) &&
      event.relatedTarget instanceof HTMLElement
    )
      returnTarget = event.relatedTarget;
    hadFocus = true;
  };
  const focusOut = () =>
    queueMicrotask(() => {
      if (!disposed && panel.isConnected && !panel.hidden && !panel.matches(':focus-within'))
        hadFocus = false;
    });
  const restoreFocus = () => {
    if (hadFocus && returnTarget?.isConnected && !panel.contains(returnTarget)) {
      const active = doc.activeElement;
      const root = panel.getRootNode();
      if (
        active === doc.body ||
        (root instanceof ShadowRoot && active === root.host) ||
        panel.contains(active)
      )
        returnTarget.focus();
    }
    hadFocus = false;
  };
  const measure = () => {
    if (!panel.hidden && doc.defaultView)
      size(
        (alertProfile.iconSize *
          Number.parseFloat(doc.defaultView.getComputedStyle(doc.documentElement).fontSize)) /
          16,
      );
  };
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
  observer?.observe(panel);
  panel.addEventListener('focusin', focusIn);
  panel.addEventListener('focusout', focusOut);
  return {
    update(next: AlertRuntimeOptions) {
      if (disposed) return;
      const changed =
        !previous?.open ||
        next.heading !== previous.heading ||
        next.description !== previous.description ||
        next.notificationKey !== previous.notificationKey;
      previous = {
        open: next.open,
        heading: next.heading,
        description: next.description,
        notificationKey: next.notificationKey,
      };
      if (!next.open) {
        ++generation;
        announcement.textContent = '';
        restoreFocus();
        disposeMaterial?.();
        disposeMaterial = undefined;
        return;
      }
      disposeMaterial ??= mountMaterialRuntime(panel);
      measure();
      if (changed) {
        const current = ++generation;
        announcement.textContent = '';
        queueMicrotask(() => {
          if (!disposed && current === generation)
            announcement.textContent = [next.heading, next.description].filter(Boolean).join('. ');
        });
      }
    },
    dispose() {
      disposed = true;
      ++generation;
      restoreFocus();
      observer?.disconnect();
      panel.removeEventListener('focusin', focusIn);
      panel.removeEventListener('focusout', focusOut);
      announcement.textContent = '';
      disposeMaterial?.();
    },
  };
}
