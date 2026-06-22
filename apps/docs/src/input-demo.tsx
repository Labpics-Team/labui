/*
 * Input parity demo — the React half.
 *
 * Mounts the native-React <Input> with the SAME specimens as the Lit `<lab-input>`
 * markup in input.html, so the Playwright suite can read both renderers' computed
 * styles (visual parity, ADR-0001) and assert the SAME form-field a11y wiring
 * (label association, aria-describedby → helper/error, aria-invalid, required,
 * disabled/readonly) on each.
 *
 * It registers the Lit element (side-effect import) and wires the theme switcher,
 * so the page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/input';
import { Input } from '@labpics/ui-react/input';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in input.html');

// Test ids ride on wrappers (the Input owns its prop API — no passthrough). The
// spec targets the `[data-lab-input]` field inside each wrapper.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-neutral">
      <Input
        label="Email"
        inputType="email"
        placeholder="you@example.com"
        helper="We never share your address."
      />
    </span>
    <span data-testid="react-invalid">
      <Input
        type="danger"
        invalid
        label="Email"
        inputType="email"
        defaultValue="not-an-email"
        error="Enter a valid email address."
        helper="We never share your address."
      />
    </span>
    <span data-testid="react-warning">
      <Input type="warning" label="Username" />
    </span>
    <span data-testid="react-success">
      <Input type="success" label="Username" />
    </span>
    <span data-testid="react-required">
      <Input label="Full name" required />
    </span>
    <span data-testid="react-disabled">
      <Input label="Locked" defaultValue="read-only" disabled />
    </span>
    <span data-testid="react-readonly">
      <Input label="Account id" defaultValue="acct_123" readOnly />
    </span>
    <span data-testid="react-size-s">
      <Input size="s" label="Small" />
    </span>
    <span data-testid="react-size-l">
      <Input size="l" label="Large" />
    </span>
  </StrictMode>,
);
