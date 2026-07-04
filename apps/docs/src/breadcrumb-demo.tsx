/*
 * Breadcrumb parity demo — the React half (and the Lit `.items` wiring).
 *
 * Mounts the native-React <Breadcrumb> with the SAME crumbs as the Lit
 * `<lab-breadcrumb>` in breadcrumb.html, so the Playwright suite can read both
 * renderers' computed styles (visual parity, ADR-0001) and their shared native
 * semantics (nav landmark, ordered list, aria-current on the last crumb).
 *
 * It registers the Lit element (side-effect import), sets its `.items` property,
 * and wires the theme switcher, so the page carries both renderers under one
 * [data-theme].
 */
import '@labpics/ui-core/breadcrumb';
import type { LabBreadcrumbItem } from '@labpics/ui-core/breadcrumb';
import { Breadcrumb } from '@labpics/ui-react/breadcrumb';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const DEMO_CRUMBS: ReadonlyArray<LabBreadcrumbItem> = [
  { label: 'Home', href: '#home' },
  { label: 'Library', href: '#library' },
  // Hrefless NON-current crumb (Figma "disabled crumb"): a non-navigable
  // grouping waypoint. It must render as a bare <span part="link"> (Lit) /
  // <span class="lab-breadcrumb-link"> (React) — no href, no role, no
  // aria-current — so the Playwright suite can assert that branch on both
  // renderers.
  { label: 'Components' },
  { label: 'Disclosure', href: '#disclosure' },
  { label: 'Breadcrumb' },
];

const litBreadcrumb = document.querySelector('lab-breadcrumb');
if (litBreadcrumb) litBreadcrumb.items = DEMO_CRUMBS;

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in breadcrumb.html');

createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-breadcrumb">
      <Breadcrumb items={DEMO_CRUMBS} />
    </span>
  </StrictMode>,
);
