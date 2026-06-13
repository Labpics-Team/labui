/**
 * <Tooltip> — the native-React twin of the Lit `<lab-tooltip>` (ADR-0001), and
 * the React half of the positioned-overlay canon.
 *
 * Same axes, same `@zag-js/tooltip` machine through the SAME Behaviors seam — here
 * via `useZag` instead of the Lit `ZagController`. The machine owns the open
 * lifecycle (hover/focus + openDelay/closeDelay), Escape-to-dismiss, `role="tooltip"`
 * + `aria-describedby`, and the DYNAMIC POSITIONING (Zag popper / Floating UI). The
 * component only spreads prop-getters onto native elements and paints with the SAME
 * `--lab-*` roles, so parity is CSS, not a second behaviour implementation.
 *
 * ── The overlay canon (React half) ───────────────────────────────────────────
 * The floating layer renders into a `createPortal` at `document.body`. That is the
 * idiomatic React escape hatch from ancestor `overflow:hidden` and stacking
 * contexts — the same guarantee the Lit twin gets from `strategy:'fixed'` inside
 * its shadow root. The portal is gated on a `mounted` flag so the server and the
 * first hydration pass emit NOTHING for it: a tooltip is client-only, so there is
 * no SSR markup to mismatch. The positioning config (`strategy:'fixed'`,
 * placement) is identical to the Lit element's — one machine, two renderers.
 *
 * Client Component: a tooltip is interactive (open state, positioning). It renders
 * as a leaf under a Server Component shell — never a `'use client'` page (dive-next P1).
 *
 * The axis types come from @labpics/ui-core (type-only — no Lit runtime), so the
 * Lit and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import type { LabTooltipPlacement, LabTooltipSize } from '@labpics/ui-core/tooltip';
import * as tooltipMachine from '@zag-js/tooltip';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useZag } from './use-zag.js';
import './tooltip.css';

type TooltipSchema = SchemaOf<tooltipMachine.Service>;
type TooltipApi = tooltipMachine.Api;

const tooltipModule: MachineModule<TooltipSchema, TooltipApi> = tooltipMachine;

export interface TooltipProps {
  /** The tooltip body — text or rich content (parity with the Lit `content`/slot). */
  content?: ReactNode;
  /** Where the floating layer sits relative to the trigger. */
  placement?: LabTooltipPlacement;
  /** Control size — drives content padding, font-size and max-width. */
  size?: LabTooltipSize;
  /** Delay in ms before the tooltip opens on hover/focus. */
  openDelay?: number;
  /** Delay in ms before the tooltip closes. */
  closeDelay?: number;
  /** When true, the machine never opens. */
  disabled?: boolean;
  /** Whether to render the pointing arrow. */
  arrow?: boolean;
  /** Fires when the machine opens or closes (machine is the source of truth). */
  onOpenChange?: (open: boolean) => void;
  /** The trigger content — wrapped in the accessible trigger button. */
  children?: ReactNode;
}

export function Tooltip({
  content,
  placement = 'bottom',
  size = 'm',
  openDelay = 400,
  closeDelay = 150,
  disabled = false,
  arrow = true,
  onOpenChange,
  children,
}: TooltipProps): ReactNode {
  const api = useZag(tooltipModule, {
    id: useId(),
    openDelay,
    closeDelay,
    disabled,
    positioning: { placement, strategy: 'fixed' },
    onOpenChange: onOpenChange ? (details) => onOpenChange(details.open) : undefined,
  });

  // Overlays are client-only: gate the body portal on mount so SSR/first hydration
  // emit nothing for the floating layer (no markup to mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const floating = (
    <div {...api.getPositionerProps()} className="lab-tooltip-positioner">
      <div {...api.getContentProps()} className="lab-tooltip-content" data-size={size}>
        {content}
        {arrow && (
          <span {...api.getArrowProps()} className="lab-tooltip-arrow">
            <span {...api.getArrowTipProps()} className="lab-tooltip-arrow-tip" />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" {...api.getTriggerProps()} className="lab-tooltip-trigger">
        {children}
      </button>
      {mounted && createPortal(floating, document.body)}
    </>
  );
}
