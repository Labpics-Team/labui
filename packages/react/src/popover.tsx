/**
 * <Popover> — the native-React twin of the Lit `<lab-popover>` (ADR-0001).
 *
 * Same axes, same `@zag-js/popover` machine through the SAME Behaviors seam — here
 * via `useZag`. The machine owns open-on-click, focus move-in + restore-on-close,
 * dismiss (Escape / outside-click), the optional modal focus-trap + scroll-lock,
 * `role="dialog"` + `aria-modal`/`aria-labelledby`/`aria-describedby`, and dynamic
 * positioning. The component spreads prop-getters and paints with the SAME `--lab-*`
 * roles — parity is CSS, not a second behaviour.
 *
 * ── The overlay canon (React half), continued ────────────────────────────────
 * The panel renders into a `createPortal` at `document.body` (`portalled:true`), the
 * idiomatic React escape from clipping/stacking ancestors — the guarantee the Lit
 * twin gets from `strategy:'fixed'` in its shadow root. The portal is gated on a
 * `mounted` flag so the server emits nothing for it (a popover is client-only).
 *
 * Client Component: a popover is interactive (open state, focus, positioning). It is
 * a leaf under a Server Component shell — never a `'use client'` page (dive-next P1).
 */
'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import type { LabPopoverPlacement, LabPopoverSize } from '@labpics/ui-core/popover';
import * as popoverMachine from '@zag-js/popover';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useZag } from './use-zag.js';
import './popover.css';

type PopoverSchema = SchemaOf<popoverMachine.Service>;
type PopoverApi = popoverMachine.Api;

const popoverModule: MachineModule<PopoverSchema, PopoverApi> = popoverMachine;

export interface PopoverProps {
  /** The panel body (parity with the Lit slot="content"). */
  content?: ReactNode;
  /** Optional panel heading — wires aria-labelledby on the dialog. */
  heading?: ReactNode;
  /** Optional panel description — wires aria-describedby on the dialog. */
  description?: ReactNode;
  /** Where the panel sits relative to the trigger. */
  placement?: LabPopoverPlacement;
  /** Control size — drives panel padding and width band. */
  size?: LabPopoverSize;
  /** When true: focus trap + scroll lock + outside-interaction disabled + scrim. */
  modal?: boolean;
  /** Render a built-in close button wired to the machine. */
  closable?: boolean;
  /** Whether to render the pointing arrow. */
  arrow?: boolean;
  /** Fires when the machine opens or closes (machine is the source of truth). */
  onOpenChange?: (open: boolean) => void;
  /** The trigger content — wrapped in the accessible trigger button. */
  children?: ReactNode;
}

export function Popover({
  content,
  heading,
  description,
  placement = 'bottom',
  size = 'm',
  modal = false,
  closable = false,
  arrow = true,
  onOpenChange,
  children,
}: PopoverProps): ReactNode {
  const api = useZag(popoverModule, {
    id: useId(),
    modal,
    portalled: true,
    positioning: { placement, strategy: 'fixed' },
    onOpenChange: onOpenChange ? (details) => onOpenChange(details.open) : undefined,
  });

  // Overlays are client-only: gate the body portal on mount so SSR/first hydration
  // emit nothing for the floating layer.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const floating = (
    <>
      {modal && api.open && <div className="lab-popover-backdrop" />}
      <div {...api.getPositionerProps()} className="lab-popover-positioner">
        <div
          {...api.getContentProps()}
          className="lab-popover-content"
          data-size={size}
          data-modal={modal || undefined}
        >
          {heading != null && (
            <h2 {...api.getTitleProps()} className="lab-popover-heading">
              {heading}
            </h2>
          )}
          {description != null && (
            <p {...api.getDescriptionProps()} className="lab-popover-description">
              {description}
            </p>
          )}
          {content}
          {closable && (
            <button
              {...api.getCloseTriggerProps()}
              className="lab-popover-close"
              aria-label="Close"
            >
              ×
            </button>
          )}
          {arrow && (
            <span {...api.getArrowProps()} className="lab-popover-arrow">
              <span {...api.getArrowTipProps()} className="lab-popover-arrow-tip" />
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <button type="button" {...api.getTriggerProps()} className="lab-popover-trigger">
        {children}
      </button>
      {mounted && createPortal(floating, document.body)}
    </>
  );
}
