/*
 * Tabs parity demo — the React half (and the Lit `.items` wiring).
 *
 * Mounts the native-React <Tabs> with the SAME specimens as the Lit `<lab-tabs>`
 * markup in tabs.html, so the Playwright suite can read both renderers' computed
 * styles (visual parity, ADR-0001) and drive each one's machine behaviour (click /
 * arrow-key selection).
 *
 * It also registers the Lit element (side-effect import), sets its `.items`
 * property (tabs are declared as data, not slotted triggers), and wires the theme
 * switcher, so the single page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/tabs';
import type { LabTabItem, LabTabs } from '@labpics/ui-core/tabs';
import { Tab, TabPanel, Tabs } from '@labpics/ui-react/tabs';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const DEMO_TABS: ReadonlyArray<LabTabItem> = [
  { value: 'account', label: 'Account' },
  { value: 'password', label: 'Password' },
  { value: 'team', label: 'Team', disabled: true },
];

// The Lit element takes its triggers as a JS property; the panel content is the
// slotted light DOM already in tabs.html. Every `<lab-tabs>` specimen on the page
// (the default plus the axis specimens) gets the SAME `.items`, so the suite can
// drive each one's machine through identical triggers.
for (const el of document.querySelectorAll<LabTabs>('lab-tabs')) {
  el.items = DEMO_TABS;
}

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in tabs.html');

// The flat trigger/panel children shared by every React specimen below. `<Tabs>`
// partitions its children by component type (`child.type === Tab`/`TabPanel`), so
// these MUST reach it as direct children — a Fragment wrapper would hide them as a
// single non-Tab node. Returned as an array (which `Children.toArray` flattens)
// and spread inline, the partition sees each Tab/TabPanel exactly as if written by
// hand. Keys silence React's list warning without changing structure.
function demoTabChildren() {
  return [
    <Tab key="t-account" value="account">
      Account
    </Tab>,
    <Tab key="t-password" value="password">
      Password
    </Tab>,
    <Tab key="t-team" value="team" disabled>
      Team
    </Tab>,
    <TabPanel key="p-account" value="account">
      Manage your account name and email.
    </TabPanel>,
    <TabPanel key="p-password" value="password">
      Update your password and two-factor security.
    </TabPanel>,
    <TabPanel key="p-team" value="team">
      Invite and manage team members.
    </TabPanel>,
  ];
}

/**
 * Event-contract specimen — wires `onValueChange` and surfaces the payload into a
 * sibling readout node, so the Playwright suite can assert the PUBLIC React event
 * fires with the right value on selection (the DOM CustomEvent is read directly on
 * the Lit side). Starts empty; the readout fills only after the machine emits.
 */
function ReactEventSpecimen() {
  const [last, setLast] = useState('');
  return (
    <span data-testid="react-tabs-event">
      <Tabs defaultValue="account" onValueChange={setLast}>
        {demoTabChildren()}
      </Tabs>
      <output data-testid="react-tabs-event-value">{last}</output>
    </span>
  );
}

createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-tabs">
      <Tabs defaultValue="account">{demoTabChildren()}</Tabs>
    </span>
    <span data-testid="react-tabs-vertical">
      <Tabs defaultValue="account" orientation="vertical">
        {demoTabChildren()}
      </Tabs>
    </span>
    <span data-testid="react-tabs-s">
      <Tabs defaultValue="account" size="s">
        {demoTabChildren()}
      </Tabs>
    </span>
    <span data-testid="react-tabs-l">
      <Tabs defaultValue="account" size="l">
        {demoTabChildren()}
      </Tabs>
    </span>
    <span data-testid="react-tabs-manual">
      <Tabs defaultValue="account" activationMode="manual">
        {demoTabChildren()}
      </Tabs>
    </span>
    <ReactEventSpecimen />
  </StrictMode>,
);
