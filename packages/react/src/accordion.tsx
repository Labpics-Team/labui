/**
 * <Accordion>/<AccordionItem> — the native-React twin of the Lit
 * `<lab-accordion>` (ADR-0001). Same axes, same `@zag-js/accordion` GROUP machine
 * through the SAME Behaviors seam — here via `useZag` instead of the Lit
 * `ZagController`. No Lit in this path. The machine owns the open state,
 * single-vs-multi disclosure, `aria-expanded`/`role="region"`/`aria-controls`/
 * `aria-labelledby`, roving keyboard navigation and focus tracking; the
 * components only spread the machine's prop-getters onto native elements and
 * paint with the SAME --lab-* roles, so parity is CSS, not a second behaviour.
 *
 * Compound shape (the React idiom the Lit single-element compound mirrors): one
 * `<Accordion>` runs ONE machine and shares its connected `api` with
 * `<AccordionItem>` leaves through context. Each `<AccordionItem>` renders its own
 * header button, indicator, and content region by spreading the machine's
 * per-value getters — so the consumer writes a flat, declarative tree and never
 * wires ARIA by hand.
 *
 * Client Component: an accordion is interactive (open state + roving focus). It
 * renders as a leaf under a Server Component shell — never a `'use client'` page
 * (dive-next P1).
 *
 * Axis types come from @labpics/ui-core (type-only — no Lit runtime), so the Lit
 * and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import type { LabAccordionOrientation, LabAccordionSize } from '@labpics/ui-core/accordion';
import * as accordionMachine from '@zag-js/accordion';
import { type ReactNode, createContext, useContext, useId } from 'react';
import { useZag } from './use-zag.js';
import './accordion.css';

type AccordionSchema = SchemaOf<accordionMachine.Service>;
type AccordionApi = accordionMachine.Api;

const accordionModule: MachineModule<AccordionSchema, AccordionApi> = accordionMachine;

/** The connected machine API shared from `<Accordion>` down to its leaves. */
const AccordionContext = createContext<AccordionApi | null>(null);

function useAccordionApi(component: string): AccordionApi {
  const api = useContext(AccordionContext);
  if (api === null) {
    throw new Error(`<${component}> must be rendered inside <Accordion>.`);
  }
  return api;
}

export interface AccordionProps {
  /** Controlled open value(s) — when set, the consumer owns the open state. */
  value?: string[];
  /** Uncontrolled initial open value(s) — read once by the machine at init. */
  defaultValue?: string[];
  /** Allow many panels open at once. */
  multiple?: boolean;
  /** Allow the single open panel to close back to none. */
  collapsible?: boolean;
  /** Group-level disable — every header becomes non-interactive. */
  disabled?: boolean;
  /** Arrow-key navigation axis across the headers. */
  orientation?: LabAccordionOrientation;
  /** Header density. */
  size?: LabAccordionSize;
  /** Fires when the machine changes the open set (machine is source of truth). */
  onValueChange?: (value: string[]) => void;
  /** `<AccordionItem>` leaves. */
  children?: ReactNode;
}

export interface AccordionItemProps {
  /** Stable identity — the open key for this panel. */
  value: string;
  /** Header (trigger) label. */
  label: ReactNode;
  /** Whether this panel cannot be opened. */
  disabled?: boolean;
  /** Panel content. */
  children?: ReactNode;
}

export function Accordion({
  value,
  defaultValue,
  multiple = false,
  collapsible = false,
  disabled = false,
  orientation = 'vertical',
  size = 'm',
  onValueChange,
  children,
}: AccordionProps): ReactNode {
  const api = useZag(accordionModule, {
    id: useId(),
    value,
    defaultValue,
    multiple,
    collapsible,
    disabled,
    orientation,
    onValueChange: onValueChange ? (details) => onValueChange(details.value) : undefined,
  });

  return (
    <AccordionContext.Provider value={api}>
      <div {...api.getRootProps()} data-lab-accordion="" data-size={size}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({ value, label, disabled, children }: AccordionItemProps): ReactNode {
  const api = useAccordionApi('AccordionItem');
  const itemProps = { value, disabled };
  return (
    <div {...api.getItemProps(itemProps)} className="lab-accordion-item">
      {/*
       * Focus-before-toggle guard (WebKit), the React twin of the Lit
       * `<lab-accordion>` fix. The `@zag-js/accordion` machine only accepts
       * `TRIGGER.CLICK` in its `focused` state, reached when the trigger fires a
       * `focus` event (`onFocus` → `TRIGGER.FOCUS`). On Chromium a native click
       * focuses the <button> first, so the click toggles. WebKit does NOT focus a
       * <button> on click; Zag compensates inside its own `onClick` only when
       * `isSafari()` is true, but `isSafari()` reads `navigator.platform`/`vendor`
       * which are not "Apple" under Playwright WebKit (platform = "Win32"), so the
       * workaround never runs and the click lands in `idle`, never toggling. We
       * restore the guarantee engine-agnostically with a CAPTURE-phase click that
       * focuses the trigger — synchronously, in the same click dispatch — before
       * Zag's bubble-phase `onClick`. No-op on engines that already focused it.
       */}
      <button
        {...api.getItemTriggerProps(itemProps)}
        className="lab-accordion-trigger"
        onClickCapture={(event) => {
          const trigger = event.currentTarget;
          if (document.activeElement !== trigger) trigger.focus();
        }}
      >
        <span className="lab-accordion-trigger-label">{label}</span>
        <span {...api.getItemIndicatorProps(itemProps)} className="lab-accordion-indicator">
          <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <div {...api.getItemContentProps(itemProps)} className="lab-accordion-content">
        {children}
      </div>
    </div>
  );
}
