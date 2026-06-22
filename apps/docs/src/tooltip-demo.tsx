/*
 * Tooltip parity demo — the React half.
 *
 * Mounts the native-React <Tooltip> with the SAME specimens as the Lit
 * `<lab-tooltip>` markup in tooltip.html, so the Playwright suite can drive each
 * renderer's machine (open on hover/focus, Escape dismiss, positioning) and read
 * both surfaces' computed styles (visual parity, ADR-0001).
 *
 * It also registers the Lit element (side-effect import) and wires the theme
 * switcher, so the single page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/tooltip';
// Per-component subpath (the tree-shaking seam): no edit to the React barrel.
import { Tooltip } from '@labpics/ui-react/tooltip';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in tooltip.html');

// The testid rides on a wrapper; the spec targets the `.lab-tooltip-trigger` inside
// each wrapper and the portalled `.lab-tooltip-content` in <body>.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-tt-bottom">
      <Tooltip placement="bottom" content="Saved to your library">
        Bottom
      </Tooltip>
    </span>
    <span data-testid="react-tt-top">
      <Tooltip placement="top" content="Saved to your library">
        Top
      </Tooltip>
    </span>
    <span data-testid="react-tt-disabled">
      <Tooltip disabled content="Never shows">
        Disabled
      </Tooltip>
    </span>
  </StrictMode>,
);
