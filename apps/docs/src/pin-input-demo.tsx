/*
 * Pin Input parity demo — the React half.
 *
 * Mounts the native-React <PinInput> with the SAME specimens as the Lit `<lab-pin-input>`
 * markup in pin-input.html, so the Playwright suite can drive each renderer's machine
 * (typing → focus auto-advance, paste-fill, masking, complete) and read both renderers'
 * computed styles (visual parity, ADR-0001) and the SAME field-a11y wiring.
 *
 * The event specimen surfaces the public onValueComplete payload into a readout node so
 * the suite can assert the complete EVENT fires with the joined value on BOTH renderers.
 *
 * It registers the Lit element (side-effect import) and wires the theme switcher, so the
 * page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/pin-input';
import { PinInput } from '@labpics/ui-react/pin-input';
import { StrictMode, useState } from 'react';
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

/** A pin input wired to a readout so the suite can assert the public complete EVENT. */
function PinInputWithEventReadout(): React.ReactNode {
  const [done, setDone] = useState('');
  return (
    <span data-testid="react-pin-event">
      <PinInput
        label="Verification code"
        count={4}
        onValueComplete={(_value, valueAsString) => setDone(valueAsString)}
      />
      <output data-testid="react-pin-event-value">{done}</output>
    </span>
  );
}

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in pin-input.html');

// Test ids ride on wrappers (the PinInput owns its prop API — no passthrough). The spec
// targets the `[data-lab-pin-input]` field inside each wrapper.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-neutral">
      <PinInput label="Verification code" count={4} helper="Enter the 4-digit code." />
    </span>
    <span data-testid="react-invalid">
      <PinInput
        type="danger"
        invalid
        label="Verification code"
        count={4}
        error="That code is incorrect."
      />
    </span>
    <span data-testid="react-masked">
      <PinInput label="PIN" count={4} mask />
    </span>
    <span data-testid="react-required">
      <PinInput label="Code" count={4} required />
    </span>
    <span data-testid="react-disabled">
      <PinInput label="Locked" count={4} disabled />
    </span>
    <span data-testid="react-size-s">
      <PinInput size="s" label="Small" count={4} />
    </span>
    <span data-testid="react-size-l">
      <PinInput size="l" label="Large" count={4} />
    </span>
    <PinInputWithEventReadout />
  </StrictMode>,
);
