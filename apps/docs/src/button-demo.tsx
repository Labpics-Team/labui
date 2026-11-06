/*
 * Button parity demo — the React half.
 *
 * Mounts the native-React <Button> with the SAME specimens as the Lit
 * `<lab-button>` markup in button.html, so the Playwright suite can read both
 * renderers' computed styles and assert they match (visual parity, ADR-0001) —
 * and drive each one's click/keyboard/a11y behaviour.
 *
 * It also registers the Lit element (side-effect import) and wires the theme
 * switcher, so the single page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/button';
import { Button } from '@labpics/ui-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootColors } from './colors-runtime.js';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();
bootColors();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in button.html');

createRoot(mount).render(
  <StrictMode>
    <Button data-testid="react-accent-fill" type="accent" kind="fill">
      Save
    </Button>
    <Button data-testid="react-neutral-tinted" type="neutral" kind="tinted">
      Cancel
    </Button>
    <Button data-testid="react-danger-border" type="danger" kind="border">
      Delete
    </Button>
    <Button data-testid="react-loading" type="accent" kind="fill" loading>
      Saving
    </Button>
    <Button data-testid="react-disabled" type="accent" kind="fill" disabled>
      Off
    </Button>
    {/* Icon-only: no children, so the ONLY name source is aria-label, forwarded
        to the native <button> via {...rest}. The iconSlot holds a decorative glyph. */}
    <Button
      data-testid="react-icon-only"
      type="accent"
      kind="fill"
      icon
      aria-label="Add item"
      iconSlot={
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width={16} height={16}>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      }
    />
    {/* Default-type button inside a form: clicking must NOT submit (htmlType
        defaults to "button"). */}
    <form data-testid="react-form" onSubmit={(e) => e.preventDefault()}>
      <Button data-testid="react-in-form" type="neutral" kind="tinted">
        Plain
      </Button>
    </form>
  </StrictMode>,
);
