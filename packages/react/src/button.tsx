/**
 * <Button> — the native-React twin of the Lit `<lab-button>` (ADR-0001).
 *
 * Same public axes, same semantic --lab-* roles, same structure (spinner +
 * label with an optional leading icon), same interaction states — so visual
 * parity with the Lit element is a matter of CSS, not a second behaviour
 * implementation. No Lit in this path: Next's shallow WC-SSR never touches
 * React, which is the whole reason A-prime keeps a native renderer.
 *
 * Client Component: a button is interactive (it carries an `onClick`, takes
 * focus, and is activated by keyboard). It renders as a leaf under a Server
 * Component shell — never a `'use client'` page (dive-next P1). The element is
 * a real native `<button>`, so role, Enter/Space activation, and focus come
 * from the platform; the component only paints and forwards props.
 *
 * The axis types come from @labpics/ui-core (type-only import — no Lit runtime),
 * so the Lit and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type {
  LabButtonHtmlType,
  LabButtonKind,
  LabButtonSize,
  LabButtonType,
} from '@labpics/ui-core';
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import './button.css';

export interface ButtonProps
  // Inherit native button attributes (onClick, name, value, form, aria-*, …),
  // minus the ones this component owns or re-types (craft-frontend P1: a clear,
  // composable prop API rather than re-inventing the platform's).
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'> {
  /** Semantic intent of the action. */
  type?: LabButtonType;
  /** Surface treatment. Separation is by surface, never a border on top. */
  kind?: LabButtonKind;
  /** Control size. */
  size?: LabButtonSize;
  /**
   * Квадратная кнопка без видимой подписи. Имя задаётся через `aria-label` либо
   * `children`: они визуально скрыты, но доступны скринридеру. Явное `aria-label`
   * передаётся нативной кнопке и имеет приоритет в обоих рендерерах.
   */
  icon?: boolean;
  /** Shows a spinner and blocks interaction without collapsing layout. */
  loading?: boolean;
  /** Disables the control. */
  disabled?: boolean;
  /** Native button behaviour inside a form. Maps to the DOM `type` attribute. */
  htmlType?: LabButtonHtmlType;
  /** Leading icon content (parity with the Lit `icon` slot). */
  iconSlot?: ReactNode;
  /** Label content (parity with the Lit default slot). */
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    type = 'accent',
    kind = 'fill',
    size = 'm',
    icon = false,
    loading = false,
    disabled = false,
    htmlType = 'button',
    iconSlot,
    children,
    ...rest
  },
  ref,
) {
  // Loading OR disabled blocks interaction — same rule as the Lit element.
  const inactive = disabled || loading;

  return (
    <button
      {...rest}
      ref={ref}
      type={htmlType}
      disabled={inactive}
      aria-busy={loading ? 'true' : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      data-lab-button=""
      data-type={type}
      data-kind={kind}
      data-size={size}
      data-icon={icon || undefined}
      data-loading={loading || undefined}
    >
      <span className="lab-button-spinner" aria-hidden="true" />
      <span className="lab-button-content">
        {iconSlot}
        <span className="lab-button-label">{children}</span>
      </span>
    </button>
  );
});
