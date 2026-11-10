'use client';

import {
  type DialogFocusContext,
  bindDialogTriggerControls,
  hasInteractiveTriggerLabel,
} from '@labpics/ui-core/shared';
import {
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type RefCallback,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

/** Привязка единственной нативной кнопки; `type` остаётся у Button/htmlType. */
export interface ModalTriggerProps {
  readonly props: Readonly<Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'>>;
  readonly ref: RefCallback<HTMLButtonElement>;
}

/** Верните одну кнопку и передайте ей props/ref; native button требует type="button". */
export type ModalTrigger = (binding: ModalTriggerProps) => ReactElement;

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** React владеет только refs и ARIA-связью; обработчик открытия приходит из Core Dialog. */
export function useModalTrigger(
  name: string,
  customTrigger: ModalTrigger | undefined,
  children: ReactNode,
) {
  if (customTrigger !== undefined && typeof customTrigger !== 'function') {
    throw new TypeError(`${name}: trigger должен быть render callback`);
  }
  if (customTrigger !== undefined && children !== undefined) {
    throw new TypeError(`${name}: задайте trigger либо содержимое кнопки через children`);
  }

  const triggerElement = useRef<HTMLButtonElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const focusContext = useRef<DialogFocusContext>({ owner: null, trigger: null, content: null });
  const disposeControls = useRef<(() => void) | undefined>();
  const contentObserver = useRef<MutationObserver>();
  const reportedInvalidContent = useRef(false);

  const clearControlReference = useCallback(() => {
    const dispose = disposeControls.current;
    disposeControls.current = undefined;
    dispose?.();
  }, []);

  const syncTrigger = useCallback((): boolean => {
    const element = triggerElement.current;
    if (!element?.isConnected) return false;
    if (element.type !== 'button' || hasInteractiveTriggerLabel(element.childNodes)) {
      trigger.current = null;
      focusContext.current = { ...focusContext.current, trigger: null };
      clearControlReference();
      if (!reportedInvalidContent.current) {
        reportedInvalidContent.current = true;
        const error = new TypeError(
          `${name}: trigger требует type="button" и неинтерактивную подпись`,
        );
        const view = element.ownerDocument.defaultView;
        // reportError сообщает отказ, сохраняя React дерево для исправления подписи.
        if (view) view.reportError(error);
        else throw error;
      }
      return false;
    }
    reportedInvalidContent.current = false;
    trigger.current = element;
    focusContext.current = { ...focusContext.current, owner: element, trigger: element };
    clearControlReference();
    const panel = content.current;
    if (panel) disposeControls.current = bindDialogTriggerControls(element, panel);
    return true;
  }, [clearControlReference, name]);

  const triggerEl = useCallback((): HTMLButtonElement | null => {
    const element = trigger.current;
    return element?.isConnected &&
      element.type === 'button' &&
      !hasInteractiveTriggerLabel(element.childNodes)
      ? element
      : null;
  }, []);

  const currentFocusContext = useCallback((): DialogFocusContext => {
    const context = focusContext.current;
    const element = context.trigger;
    return element &&
      (element.getAttribute('type')?.toLowerCase() !== 'button' ||
        hasInteractiveTriggerLabel(element.childNodes))
      ? { ...context, trigger: null }
      : context;
  }, []);

  const triggerRef: RefCallback<HTMLButtonElement> = useCallback(
    (element) => {
      if (!element) {
        triggerElement.current = null;
        trigger.current = null;
        contentObserver.current?.disconnect();
        contentObserver.current = undefined;
        clearControlReference();
        return;
      }
      const ButtonElement = element.ownerDocument.defaultView?.HTMLButtonElement;
      if (!ButtonElement || !(element instanceof ButtonElement) || element.type !== 'button') {
        throw new TypeError(`${name}: trigger ref требует HTMLButtonElement с type="button"`);
      }
      if (triggerElement.current && triggerElement.current !== element) {
        throw new TypeError(`${name}: trigger ref может принадлежать только одной кнопке`);
      }
      triggerElement.current = element;
      reportedInvalidContent.current = false;
      // Последние настоящие узлы остаются доступны Core focus cleanup после unmount.
      focusContext.current = { ...focusContext.current, owner: element, trigger: null };
      contentObserver.current?.disconnect();
      const observer = new MutationObserver(() => syncTrigger());
      contentObserver.current = observer;
      observer.observe(element, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'type',
          'href',
          'xlink:href',
          'usemap',
          'tabindex',
          'contenteditable',
          'role',
          'controls',
        ],
      });
      syncTrigger();
    },
    [clearControlReference, name, syncTrigger],
  );

  const contentRef: RefCallback<HTMLDivElement> = useCallback(
    (element) => {
      content.current = element;
      if (element) {
        focusContext.current = { ...focusContext.current, content: element };
        syncTrigger();
      } else clearControlReference();
    },
    [clearControlReference, syncTrigger],
  );

  useClientLayoutEffect(() => {
    const element = triggerElement.current;
    if (!element?.isConnected) {
      throw new TypeError(`${name}: trigger должен передать ref своей нативной кнопке`);
    }
    if (
      customTrigger !== undefined &&
      (!element.id ||
        element.getAttribute('data-scope') !== 'dialog' ||
        element.getAttribute('data-part') !== 'trigger' ||
        !element.getAttribute('data-ownedby') ||
        element.getAttribute('aria-haspopup') !== 'dialog' ||
        !['true', 'false'].includes(element.getAttribute('aria-expanded') ?? ''))
    ) {
      throw new TypeError(`${name}: trigger должен передать props своей нативной кнопке`);
    }
    syncTrigger();
  });

  useClientLayoutEffect(() => clearControlReference, [clearControlReference]);

  function renderTrigger(binding: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement {
    const { type: _nativeType, ...props } = binding;
    const onClick = props.onClick;
    props.onClick = (event) => {
      if (!syncTrigger() || event.currentTarget !== trigger.current || trigger.current.disabled)
        return;
      onClick?.(event);
    };
    // Связью владеет DOM binding; React не возвращает IDREF после отказа/cleanup.
    props['aria-controls'] = undefined;
    if (customTrigger !== undefined) {
      const rendered = customTrigger({ props, ref: triggerRef });
      if (!isValidElement(rendered)) {
        throw new TypeError(`${name}: trigger должен вернуть React element кнопки`);
      }
      return rendered;
    }
    return (
      <button {...props} ref={triggerRef} type="button" className="lab-dialog-trigger">
        {children}
      </button>
    );
  }

  return { triggerEl, contentRef, focusContext: currentFocusContext, renderTrigger };
}
