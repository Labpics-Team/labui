'use client';
import {
  type LabTooltipPlacement,
  type LabTooltipSize,
  type LabTooltipTail,
  type LabTooltipType,
  mountTooltip,
} from '@labpics/ui-core/tooltip/runtime';
import {
  Children,
  type ReactElement,
  type ReactNode,
  type Ref,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import '@labpics/ui-materials/material.css';
import '@labpics/ui-core/tooltip.css';

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface TooltipProps {
  /** Supplementary non-interactive text; essential instructions belong inline. */
  content?: ReactNode;
  placement?: LabTooltipPlacement;
  type?: LabTooltipType;
  /** M is authored; S and L are compatibility extensions. */
  size?: LabTooltipSize;
  tail?: LabTooltipTail;
  openDelay?: number;
  closeDelay?: number;
  disabled?: boolean;
  arrow?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** One native control or ref-forwarding control, e.g. Button. Plain text becomes focusable. */
  children?: ReactNode;
}

export function Tooltip({
  content,
  placement = 'bottom',
  type = 'neutral',
  size = 'm',
  tail = 'chevron',
  openDelay = 400,
  closeDelay = 150,
  disabled = false,
  arrow = true,
  onOpenChange,
  children,
}: TooltipProps): ReactNode {
  const trigger = useRef<HTMLElement | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const positioner = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const pointer = useRef<HTMLSpanElement>(null);
  const controller = useRef<ReturnType<typeof mountTooltip>>();
  const child = isValidElement(children)
    ? (Children.only(children) as ReactElement<{ ref?: Ref<HTMLElement> }>)
    : null;
  // React 18 stores ref on the element; React 19 stores it in props. Inspect
  // value descriptors so neither version's deprecated getter is evaluated.
  const childRef: Ref<HTMLElement> | undefined = child
    ? (Object.getOwnPropertyDescriptor(child.props, 'ref')?.value ??
      Object.getOwnPropertyDescriptor(child, 'ref')?.value)
    : undefined;
  const setTrigger = useCallback(
    (node: HTMLElement | null) => {
      trigger.current = node;
      setTarget(node);
      if (typeof childRef === 'function') {
        const cleanup = (childRef as (node: HTMLElement | null) => unknown)(node);
        if (typeof cleanup === 'function')
          return () => {
            trigger.current = null;
            setTarget(null);
            cleanup();
          };
      } else if (childRef) (childRef as { current: HTMLElement | null }).current = node;
    },
    [childRef],
  );
  const options = {
    placement,
    openDelay,
    closeDelay,
    disabled,
    arrow,
    tail,
    description: () => surface.current?.textContent ?? '',
    onOpenChange,
  };
  const latest = useRef(options);
  latest.current = options;
  useClientLayoutEffect(() => {
    if (!target) return;
    if (!trigger.current || !positioner.current || !surface.current || !pointer.current)
      throw new TypeError('Tooltip needs a control forwarding its ref to a native element.');
    controller.current = mountTooltip(
      trigger.current,
      positioner.current,
      surface.current,
      pointer.current,
      latest.current,
    );
    return () => {
      controller.current?.dispose();
      controller.current = undefined;
    };
  }, [target]);
  useClientLayoutEffect(() => {
    controller.current?.update(options);
  });
  return (
    <>
      {child ? (
        cloneElement(child, { ref: setTrigger })
      ) : (
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Passive text needs a keyboard path to its supplementary description.
        <span ref={setTrigger} tabIndex={0} className="lab-tooltip-fallback">
          {children}
        </span>
      )}
      <div ref={positioner} {...{ popover: 'manual' }} className="lab-tooltip-positioner">
        <div ref={surface} className="lab-tooltip-content" data-size={size} data-type={type} hidden>
          {content}
          <span
            ref={pointer}
            aria-hidden="true"
            hidden={!arrow}
            className="lab-tooltip-arrow"
            data-tail={tail}
          />
        </div>
      </div>
    </>
  );
}
