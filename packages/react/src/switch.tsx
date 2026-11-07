/**
 * <Switch> — the native-React twin of the Lit `<lab-switch>` (ADR-0001).
 *
 * Same axes, same `@zag-js/switch` machine through the SAME Behaviors seam — here
 * via `useZag` (the React side) instead of the Lit `ZagController`. No Lit in this
 * path; Next's shallow WC-SSR never touches React. The machine owns checked-state,
 * keyboard (Space), focus, and the hidden checkbox's accessibility and form
 * participation — the component only spreads the machine's prop-getters onto native
 * elements and paints with the SAME --lab-* roles, so parity is CSS, not a second
 * behaviour implementation.
 *
 * Client Component: a switch is interactive (state + onChange). It renders as a
 * leaf under a Server Component shell — never a `'use client'` page (dive-next P1).
 *
 * The axis types come from @labpics/ui-core (type-only — no Lit runtime), so the
 * Lit and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type { LabSwitchSize, LabSwitchType } from '@labpics/ui-core';
import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import { type SwitchMotion, mountSwitchMotion } from '@labpics/ui-core/motion';
import {
  type SwitchLabelContent,
  observeSwitchLabelContent,
  switchLabelContents,
  switchLabelElementContent,
} from '@labpics/ui-core/shared';
import * as switchMachine from '@zag-js/switch';
import {
  type CSSProperties,
  Children,
  Fragment,
  type ReactNode,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useZag } from './use-zag.js';
import './switch.css';

type SwitchSchema = SchemaOf<switchMachine.Service>;
type SwitchApi = switchMachine.Api;

const switchModule: MachineModule<SwitchSchema, SwitchApi> = switchMachine;

// Сервер отдаёт CSS-позу. В браузере scope подключается до первого paint.
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function labelInputNodes(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child): ReactNode[] => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment)
      return labelInputNodes(child.props.children);
    return [child];
  });
}

function labelInputContent(children: ReactNode): SwitchLabelContent {
  return switchLabelContents(
    labelInputNodes(children).map((child): SwitchLabelContent => {
      if (typeof child === 'string') return child.trim() ? 'present' : 'empty';
      if (typeof child === 'number') return 'present';
      if (
        isValidElement<{
          children?: ReactNode;
          'aria-label'?: string;
          'aria-labelledby'?: string;
          title?: string;
          role?: string;
          alt?: string;
          className?: string;
          style?: CSSProperties;
          hidden?: boolean;
          'aria-hidden'?: boolean | 'true' | 'false';
          dangerouslySetInnerHTML?: { __html: string };
        }>(child)
      ) {
        if (typeof child.type === 'string' && !child.props.dangerouslySetInnerHTML) {
          return switchLabelElementContent(
            child.type,
            () => labelInputContent(child.props.children),
            (name) => (name === 'class' ? child.props.className : child.props[name]),
            () => {
              if (child.type !== 'svg') return 'unknown';
              const title = labelInputNodes(child.props.children).find(
                (node) => isValidElement(node) && node.type === 'title',
              );
              return isValidElement<{ children?: ReactNode }>(title)
                ? labelInputContent(title.props.children)
                : 'empty';
            },
          );
        }
      }
      // Opaque components/HTML сохраняют прежний children-контракт.
      return 'unknown';
    }),
  );
}

export interface SwitchProps {
  /** Semantic intent of the switch's ON state. */
  type?: LabSwitchType;
  /** Control size. */
  size?: LabSwitchSize;
  /** Controlled checked state — when set, the consumer owns the value. */
  checked?: boolean;
  /** Uncontrolled initial state — read once by the machine at init. */
  defaultChecked?: boolean;
  /** Disables the control. */
  disabled?: boolean;
  /** Fires when the machine flips the checked state (machine is source of truth). */
  onCheckedChange?: (checked: boolean) => void;
  /** Native form field name for the hidden input. */
  name?: string;
  /** Подпись перед дорожкой; children сохраняет подпись после неё. */
  labelStart?: string;
  /** Скрытая сторона не занимает место и не участвует в доступном имени. */
  hideLabelStart?: boolean;
  hideLabelEnd?: boolean;
  /** Icon shown inside the track when ON (parity with the Lit `icon-on` slot). */
  iconOn?: ReactNode;
  /** Icon shown inside the track when OFF (parity with the Lit `icon-off` slot). */
  iconOff?: ReactNode;
  /**
   * Accessible name for the no-visible-label case (e.g. an icon-only switch).
   * Parity with the Lit `aria-label`. A visible label (`children`) is preferred
   * over it via the machine's `aria-labelledby`.
   */
  'aria-label'?: string;
  /** Label content (parity with the Lit default slot). */
  children?: ReactNode;
}

export function Switch({
  type = 'accent',
  size = 'm',
  checked,
  defaultChecked,
  disabled = false,
  onCheckedChange,
  name,
  labelStart = '',
  hideLabelStart = false,
  hideLabelEnd = false,
  iconOn,
  iconOff,
  'aria-label': ariaLabel,
  children,
}: SwitchProps): ReactNode {
  const id = useId();
  const api = useZag(switchModule, {
    id,
    checked,
    defaultChecked,
    disabled,
    name,
    onCheckedChange: onCheckedChange ? (details) => onCheckedChange(details.checked) : undefined,
  });
  const rootRef = useRef<HTMLLabelElement>(null);
  const labelEndRef = useRef<HTMLSpanElement>(null);
  const [labelEndContent, setLabelEndContent] = useState(() => labelInputContent(children));
  const trackRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const motionRef = useRef<SwitchMotion>();
  const checkedRef = useRef(api.checked);
  checkedRef.current = api.checked;

  useClientLayoutEffect(() => {
    const label = labelEndRef.current;
    if (!label) return;
    return observeSwitchLabelContent(label, setLabelEndContent, label);
  }, [children]);

  useClientLayoutEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!root || !track || !thumb) return;
    const motion = mountSwitchMotion(root, track, thumb, checkedRef.current);
    motionRef.current = motion;
    return () => {
      motion.dispose();
      motionRef.current = undefined;
    };
  }, []);

  useClientLayoutEffect(() => {
    motionRef.current?.update(api.checked);
  });

  const labelChildren = Children.toArray(children);
  const hasStart = !hideLabelStart && Boolean(labelStart?.trim());
  const hasEnd = !hideLabelEnd && labelEndContent === 'present';
  const labelStartId = `${id}-label-start`;
  const labelEndId = `${id}-label-end`;
  const ids = [hasStart ? labelStartId : undefined, hasEnd ? labelEndId : undefined].filter(
    Boolean,
  );
  const inputProps = {
    ...api.getHiddenInputProps(),
    'aria-labelledby': ids.length ? ids.join(' ') : undefined,
    'aria-label': ids.length ? undefined : ariaLabel,
  };

  return (
    <label
      {...api.getRootProps()}
      ref={rootRef}
      data-lab-switch=""
      data-type={type}
      data-size={size}
      data-checked={api.checked || undefined}
      data-disabled={api.disabled || undefined}
    >
      {hasStart && (
        <span
          {...api.getLabelProps()}
          id={labelStartId}
          className="lab-switch-label lab-switch-label-start"
        >
          {labelStart}
        </span>
      )}
      <input {...inputProps} />
      <span {...api.getControlProps()} ref={trackRef} className="lab-switch-control">
        <span className="lab-switch-icon lab-switch-icon-on" aria-hidden="true">
          {iconOn}
        </span>
        <span className="lab-switch-icon lab-switch-icon-off" aria-hidden="true">
          {iconOff}
        </span>
        <span {...api.getThumbProps()} ref={thumbRef} className="lab-switch-thumb" />
      </span>
      <span
        {...api.getLabelProps()}
        ref={labelEndRef}
        id={labelEndId}
        className="lab-switch-label lab-switch-label-end"
        hidden={hideLabelEnd || labelEndContent === 'empty'}
      >
        {labelChildren}
      </span>
    </label>
  );
}
