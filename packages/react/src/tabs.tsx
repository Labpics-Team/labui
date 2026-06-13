/**
 * <Tabs>/<Tab>/<TabPanel> — the native-React twin of the Lit `<lab-tabs>`
 * (ADR-0001). Same axes, same `@zag-js/tabs` GROUP machine through the SAME
 * Behaviors seam — here via `useZag` instead of the Lit `ZagController`. No Lit in
 * this path. The machine owns selection, roving focus, arrow-key navigation,
 * `role="tablist"`/`tab`/`tabpanel`, and automatic-vs-manual activation; the
 * components only spread the machine's prop-getters onto native elements and paint
 * with the SAME --lab-* roles, so parity is CSS, not a second behaviour.
 *
 * Compound shape (the React idiom the Lit single-element compound mirrors): one
 * `<Tabs>` runs ONE machine and shares its connected `api` with `<Tab>`/`<TabPanel>`
 * leaves through context. `<Tabs>` partitions its children into triggers (rendered
 * inside the machine's list wrapper, for roving focus) and panels (rendered after),
 * so the consumer writes a flat, declarative tree — `<Tab>` for each trigger,
 * `<TabPanel>` for each panel — and never wires the list wrapper by hand.
 *
 * Client Component: tabs are interactive (selection + roving focus). They render
 * as a leaf under a Server Component shell — never a `'use client'` page
 * (dive-next P1).
 *
 * Axis types come from @labpics/ui-core (type-only — no Lit runtime), so the Lit
 * and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import type { LabTabsActivationMode, LabTabsOrientation, LabTabsSize } from '@labpics/ui-core/tabs';
import * as tabsMachine from '@zag-js/tabs';
import { Children, type ReactNode, createContext, isValidElement, useContext, useId } from 'react';
import { useZag } from './use-zag.js';
import './tabs.css';

type TabsSchema = SchemaOf<tabsMachine.Service>;
type TabsApi = tabsMachine.Api;

const tabsModule: MachineModule<TabsSchema, TabsApi> = tabsMachine;

/** The connected machine API shared from `<Tabs>` down to its leaves. */
const TabsContext = createContext<TabsApi | null>(null);

function useTabsApi(component: string): TabsApi {
  const api = useContext(TabsContext);
  if (api === null) {
    throw new Error(`<${component}> must be rendered inside <Tabs>.`);
  }
  return api;
}

export interface TabsProps {
  /** Controlled selected value — when set, the consumer owns the selection. */
  value?: string;
  /** Uncontrolled initial selection — read once by the machine at init. */
  defaultValue?: string;
  /** List axis. */
  orientation?: LabTabsOrientation;
  /** Trigger density. */
  size?: LabTabsSize;
  /** Select on focus (automatic) or on Enter/Space (manual). */
  activationMode?: LabTabsActivationMode;
  /** Fires when the machine changes the selected tab (machine is source of truth). */
  onValueChange?: (value: string) => void;
  /** `<Tab>` and `<TabPanel>` leaves. */
  children?: ReactNode;
}

export interface TabProps {
  /** Stable identity — must match a sibling `<TabPanel value>`. */
  value: string;
  /** Whether this tab cannot be selected. */
  disabled?: boolean;
  /** Trigger label. */
  children?: ReactNode;
}

export interface TabPanelProps {
  /** Stable identity — must match its `<Tab value>`. */
  value: string;
  /** Panel content. */
  children?: ReactNode;
}

export function Tabs({
  value,
  defaultValue,
  orientation = 'horizontal',
  size = 'm',
  activationMode = 'automatic',
  onValueChange,
  children,
}: TabsProps): ReactNode {
  const api = useZag(tabsModule, {
    id: useId(),
    value,
    defaultValue,
    orientation,
    activationMode,
    onValueChange: onValueChange ? (details) => onValueChange(details.value) : undefined,
  });

  // Partition the flat children into triggers and panels. Triggers must live
  // inside the machine's list wrapper (roving focus + orientation); panels render
  // after it. Identity is by component reference, so only real Tab/TabPanel leaves
  // are placed — anything else is ignored rather than mis-wired.
  const childArray = Children.toArray(children);
  const triggers = childArray.filter((child) => isValidElement(child) && child.type === Tab);
  const panels = childArray.filter((child) => isValidElement(child) && child.type === TabPanel);

  return (
    <TabsContext.Provider value={api}>
      <div {...api.getRootProps()} data-lab-tabs="" data-size={size}>
        <div {...api.getListProps()} className="lab-tabs-list">
          {triggers}
        </div>
        {panels}
      </div>
    </TabsContext.Provider>
  );
}

export function Tab({ value, disabled, children }: TabProps): ReactNode {
  const api = useTabsApi('Tab');
  return (
    <button {...api.getTriggerProps({ value, disabled })} className="lab-tabs-trigger">
      {children}
    </button>
  );
}

export function TabPanel({ value, children }: TabPanelProps): ReactNode {
  const api = useTabsApi('TabPanel');
  return (
    <div {...api.getContentProps({ value })} className="lab-tabs-panel">
      {children}
    </div>
  );
}
