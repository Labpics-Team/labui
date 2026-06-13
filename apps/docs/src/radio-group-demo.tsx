/*
 * Radio Group parity demo — the React half.
 *
 * Mounts the native-React compound <RadioGroup>/<Radio> with the SAME specimens
 * as the Lit `<lab-radio-group>` markup in radio-group.html, so the Playwright
 * suite can read both renderers' computed styles (visual parity) and drive each
 * one's machine behaviour (selection, roving keyboard). The Lit side is
 * controlled-but-self-reflecting via `value`; the React side is uncontrolled via
 * `defaultValue` — both start on "express" and both move on interaction.
 */
import '@labpics/ui-core/radio-group';
import { Radio, RadioGroup } from '@labpics/ui-react/radio-group';
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

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in radio-group.html');

// Test ids ride on wrappers (the RadioGroup owns its prop API — no passthrough).
// The spec targets the `[data-lab-radio-group]` root inside each wrapper.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-accent">
      <RadioGroup type="accent" label="Delivery (accent)" defaultValue="express">
        <Radio value="standard">Standard</Radio>
        <Radio value="express">Express</Radio>
        <Radio value="overnight" disabled>
          Overnight
        </Radio>
      </RadioGroup>
    </span>
    <span data-testid="react-neutral">
      <RadioGroup type="neutral" label="Delivery (neutral)" defaultValue="express">
        <Radio value="standard">Standard</Radio>
        <Radio value="express">Express</Radio>
        <Radio value="overnight" disabled>
          Overnight
        </Radio>
      </RadioGroup>
    </span>
    <span data-testid="react-danger">
      <RadioGroup type="danger" label="Delivery (danger)" defaultValue="express">
        <Radio value="standard">Standard</Radio>
        <Radio value="express">Express</Radio>
        <Radio value="overnight" disabled>
          Overnight
        </Radio>
      </RadioGroup>
    </span>
    <span data-testid="react-vertical">
      <RadioGroup
        type="accent"
        orientation="vertical"
        label="Delivery (vertical)"
        defaultValue="express"
      >
        <Radio value="standard">Standard</Radio>
        <Radio value="express">Express</Radio>
        <Radio value="overnight" disabled>
          Overnight
        </Radio>
      </RadioGroup>
    </span>
    <span data-testid="react-disabled">
      <RadioGroup type="accent" disabled label="Delivery (disabled)" defaultValue="express">
        <Radio value="standard">Standard</Radio>
        <Radio value="express">Express</Radio>
        <Radio value="overnight" disabled>
          Overnight
        </Radio>
      </RadioGroup>
    </span>
  </StrictMode>,
);
