'use client';

import { type DialogFocusContext, bindDialogTriggerControls } from '@labpics/ui-core/shared';
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

  const trigger = useRef<HTMLButtonElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const focusContext = useRef<DialogFocusContext>({ owner: null, trigger: null, content: null });
  const disposeControls = useRef<(() => void) | undefined>();

  const clearControlReference = useCallback(() => {
    const dispose = disposeControls.current;
    disposeControls.current = undefined;
    dispose?.();
  }, []);

  const triggerRef: RefCallback<HTMLButtonElement> = useCallback(
    (element) => {
      if (!element) {
        trigger.current = null;
        clearControlReference();
        return;
      }
      const ButtonElement = element.ownerDocument.defaultView?.HTMLButtonElement;
      if (!ButtonElement || !(element instanceof ButtonElement) || element.type !== 'button') {
        throw new TypeError(`${name}: trigger ref требует HTMLButtonElement с type="button"`);
      }
      if (trigger.current && trigger.current !== element) {
        throw new TypeError(`${name}: trigger ref может принадлежать только одной кнопке`);
      }
      trigger.current = element;
      // Последние настоящие узлы остаются доступны Core focus cleanup после unmount.
      focusContext.current = { ...focusContext.current, owner: element, trigger: element };
    },
    [clearControlReference, name],
  );

  const contentRef: RefCallback<HTMLDivElement> = useCallback(
    (element) => {
      content.current = element;
      if (element) focusContext.current = { ...focusContext.current, content: element };
      else clearControlReference();
    },
    [clearControlReference],
  );

  useClientLayoutEffect(() => {
    const element = trigger.current;
    if (!element?.isConnected) {
      throw new TypeError(`${name}: trigger должен передать ref своей нативной кнопке`);
    }
    if (element.type !== 'button') {
      throw new TypeError(`${name}: trigger требует нативный type="button"`);
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
    const panel = content.current;
    if (!panel) return;
    clearControlReference();
    disposeControls.current = bindDialogTriggerControls(element, panel);
  });

  useClientLayoutEffect(() => clearControlReference, [clearControlReference]);

  function renderTrigger(
    binding: ButtonHTMLAttributes<HTMLButtonElement>,
    mounted: boolean,
  ): ReactElement {
    const { type: _nativeType, ...props } = binding;
    if (!mounted) props['aria-controls'] = undefined;
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

  return { trigger, contentRef, focusContext, renderTrigger };
}
