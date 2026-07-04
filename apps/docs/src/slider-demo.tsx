/*
 * Slider parity demo — the React half.
 *
 * Mounts the native-React <Slider> with the SAME specimens as the Lit `<lab-slider>`
 * markup in slider.html, so the Playwright suite can drive each renderer's machine
 * (keyboard stepping, drag, multi-thumb) and read both renderers' computed styles
 * (visual parity, ADR-0001) and the SAME field-a11y wiring.
 *
 * It registers the Lit element (side-effect import) and wires the theme switcher, so
 * the page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/slider';
import { Slider } from '@labpics/ui-react/slider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in slider.html');

// Test ids ride on wrappers (the Slider owns its prop API — no passthrough). The spec
// targets the `[data-lab-slider]` control inside each wrapper.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-single">
      <Slider label="Volume" defaultValue={[40]} showValue helper="Drag or use the arrow keys." />
    </span>
    <span data-testid="react-range">
      <Slider label="Price range" defaultValue={[20, 80]} showValue />
    </span>
    <span data-testid="react-step">
      <Slider label="Step 10" defaultValue={[50]} step={10} />
    </span>
    <span data-testid="react-invalid">
      <Slider label="Volume" defaultValue={[40]} invalid error="Out of allowed range." />
    </span>
    <span data-testid="react-disabled">
      <Slider label="Locked" defaultValue={[30]} disabled />
    </span>
    <span data-testid="react-size-s">
      <Slider size="s" label="Small" defaultValue={[40]} />
    </span>
    <span data-testid="react-size-l">
      <Slider size="l" label="Large" defaultValue={[40]} />
    </span>
  </StrictMode>,
);
