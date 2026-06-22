/*
 * Menu parity demo — the React half.
 *
 * Mounts the native-React <Menu> with the SAME specimens as the Lit `<lab-menu>`
 * markup in menu.html, so the Playwright suite can drive each renderer's machine
 * (open on click, navigation, run-an-item, Escape / outside-click dismiss,
 * positioning) and read both menus' computed styles (visual parity, ADR-0001).
 */
import '@labpics/ui-core/menu';
// Per-component subpath (the tree-shaking seam): no edit to the React barrel.
import { Menu } from '@labpics/ui-react/menu';
import type { LabMenuItem } from '@labpics/ui-core/menu';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const ACTIONS: LabMenuItem[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'archive', label: 'Archive', disabled: true },
  { value: 'sep-1', label: '', separator: true },
  { value: 'delete', label: 'Delete', danger: true },
];

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in menu.html');

// The testid rides on a wrapper; the spec targets `.lab-menu-trigger` inside the
// wrapper and the portalled `.lab-menu-content` in <body>.
const DISABLED_ACTIONS: LabMenuItem[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'duplicate', label: 'Duplicate' },
];

createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-menu">
      <Menu label="Actions" items={ACTIONS} />
    </span>
    {/* Disabled trigger: the menu must NOT open on click (parity with Lit). */}
    <span data-testid="react-menu-disabled">
      <Menu label="Actions" items={DISABLED_ACTIONS} disabled />
    </span>
  </StrictMode>,
);
