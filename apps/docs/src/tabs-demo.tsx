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
import type { LabTabItem } from '@labpics/ui-core/tabs';
import { Tab, TabPanel, Tabs } from '@labpics/ui-react/tabs';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.documentElement;

const THEMES = ['dark', 'light'] as const;
type Theme = (typeof THEMES)[number];

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

const select = document.querySelector<HTMLSelectElement>('[data-testid="theme-select"]');
if (select) {
  const current = root.getAttribute('data-theme');
  if (current) select.value = current;
  select.addEventListener('change', () => {
    if (isTheme(select.value)) root.setAttribute('data-theme', select.value);
  });
}

const DEMO_TABS: ReadonlyArray<LabTabItem> = [
  { value: 'account', label: 'Account' },
  { value: 'password', label: 'Password' },
  { value: 'team', label: 'Team', disabled: true },
];

// The Lit element takes its triggers as a JS property; the panel content is the
// slotted light DOM already in tabs.html.
const litTabs = document.querySelector('lab-tabs');
if (litTabs) litTabs.items = DEMO_TABS;

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in tabs.html');

createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-tabs">
      <Tabs defaultValue="account">
        <Tab value="account">Account</Tab>
        <Tab value="password">Password</Tab>
        <Tab value="team" disabled>
          Team
        </Tab>
        <TabPanel value="account">Manage your account name and email.</TabPanel>
        <TabPanel value="password">Update your password and two-factor security.</TabPanel>
        <TabPanel value="team">Invite and manage team members.</TabPanel>
      </Tabs>
    </span>
  </StrictMode>,
);
