/**
 * <Menu> — the native-React twin of the Lit `<lab-menu>` (ADR-0001), the second
 * compound + positioned React canon.
 *
 * Same axes, same `@zag-js/menu` machine through the SAME Behaviors seam — here via
 * `useZag`. The machine owns open-on-click, the positioned menu, Arrow/Home/End
 * navigation, typeahead, Escape/outside-click dismiss, focus restoration, and
 * `role="menu"`/`menuitem` + aria. The component only spreads prop-getters and paints
 * with the SAME `--lab-*` roles, so parity is CSS, not a second behaviour.
 *
 * Compound shape — items are DATA, keyed by value:
 *   A menu has no collection; each item's value IS its key, passed directly to
 *   `getItemProps({ value })`. The React twin takes the SAME declarative `items` prop
 *   as the Lit element so both renderers describe an item identically (ONE source of
 *   truth for the shape) and the option set stays in lockstep with no provider/child
 *   drift. A `separator` entry is a non-interactive divider.
 *
 * ── The overlay canon (React half) ───────────────────────────────────────────
 * The menu renders into a `createPortal` at `document.body` (`portalled:true`), the
 * idiomatic React escape from clipping/stacking ancestors — the guarantee the Lit
 * twin gets from `strategy:'fixed'` in its shadow root. The portal is gated on a
 * `mounted` flag so the server emits nothing for it (a menu is client-only).
 *
 * Client Component: a menu is interactive (open state, navigation, positioning). It
 * is a leaf under a Server Component shell — never a `'use client'` page (dive-next P1).
 *
 * The axis types and the item shape come from @labpics/ui-core/menu (type-only — no
 * Lit runtime), so the Lit and React APIs share ONE source of truth.
 */
'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import type { LabMenuItem, LabMenuPlacement, LabMenuSize } from '@labpics/ui-core/menu';
import * as menuMachine from '@zag-js/menu';
import { type ReactNode, useId, useRef } from 'react';
import { ThemePortal } from './internal/theme-portal.js';
import { useZag } from './use-zag.js';
import './menu.css';

type MenuSchema = SchemaOf<menuMachine.Service>;
type MenuApi = menuMachine.Api;

const menuModule: MachineModule<MenuSchema, MenuApi> = menuMachine;

export interface MenuProps {
  /** The items. Each item's value is its key; a `separator` entry is a divider. */
  items: ReadonlyArray<LabMenuItem>;
  /** Control size — drives menu font band and item padding. */
  size?: LabMenuSize;
  /** Where the menu sits relative to the trigger. */
  placement?: LabMenuPlacement;
  /**
   * Trigger non-interactive when true. The `@zag-js/menu` machine has no top-level
   * `disabled`, so the disable is element-level: the native `disabled` attribute is
   * set on the trigger `<button>` (matching the Lit twin). The disabled VISUAL fires
   * from `.lab-menu-trigger:disabled`.
   */
  disabled?: boolean;
  /** Label shown in the trigger button. */
  label?: ReactNode;
  /** Fires with the chosen item's value when an item is selected (machine is truth). */
  onSelect?: (value: string) => void;
  /** Fires when the machine opens or closes the menu. */
  onOpenChange?: (open: boolean) => void;
}

export function Menu({
  items,
  size = 'm',
  placement = 'bottom-start',
  disabled = false,
  label = 'Menu',
  onSelect,
  onOpenChange,
}: MenuProps): ReactNode {
  const api = useZag(menuModule, {
    id: useId(),
    positioning: { placement, strategy: 'fixed' },
    onSelect: onSelect ? (details) => onSelect(details.value) : undefined,
    onOpenChange: onOpenChange ? (details) => onOpenChange(details.open) : undefined,
  });

  const portalSource = useRef<HTMLButtonElement>(null);

  const menu = (
    <div {...api.getPositionerProps()} className="lab-menu-positioner">
      <ul {...api.getContentProps()} className="lab-menu-content" data-size={size}>
        {items.map((item, index) =>
          item.separator ? (
            // A separator has no value to key on and carries no behaviour; key by a
            // stable composite so React reconciles it without an index-only key.
            <li
              key={`sep-${item.value || index}`}
              {...api.getSeparatorProps()}
              className="lab-menu-separator"
            />
          ) : (
            // Keyed by the STABLE value, never the index: the machine keys its
            // per-item getters by value, and the id it puts on the item is what
            // aria-activedescendant points at. React's key and the machine's value
            // agree, so a row never gets another item's props.
            <li
              key={item.value}
              {...api.getItemProps({ value: item.value, disabled: item.disabled })}
              className="lab-menu-item"
              data-danger={item.danger || undefined}
            >
              {item.label}
            </li>
          ),
        )}
      </ul>
    </div>
  );

  return (
    <>
      <button
        {...api.getTriggerProps()}
        ref={portalSource}
        className="lab-menu-trigger"
        data-size={size}
        disabled={disabled}
      >
        <span className="lab-menu-trigger-label">{label}</span>
        <span className="lab-menu-trigger-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <ThemePortal source={portalSource}>{menu}</ThemePortal>
    </>
  );
}
