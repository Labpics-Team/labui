/*
 * Textarea parity demo — the React half.
 *
 * Mounts the native-React <Textarea> with the SAME specimens as the Lit
 * `<lab-textarea>` markup in textarea.html, so the Playwright suite can read both
 * renderers' computed styles (visual parity, ADR-0001) and assert the SAME
 * form-field a11y wiring (label association, aria-describedby → helper/error,
 * aria-invalid, required, disabled/readonly) and the auto-resize behaviour on each.
 *
 * It registers the Lit element (side-effect import) and wires the theme switcher,
 * so the page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/textarea';
import { Textarea } from '@labpics/ui-react/textarea';
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
if (!mount) throw new Error('Missing #react-root mount node in textarea.html');

// Test ids ride on wrappers (the Textarea owns its prop API — no passthrough). The
// spec targets the `[data-lab-textarea]` field inside each wrapper.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-neutral">
      <Textarea label="Bio" placeholder="Tell us about yourself" helper="Markdown is supported." />
    </span>
    <span data-testid="react-invalid">
      <Textarea
        type="danger"
        invalid
        label="Bio"
        defaultValue="x"
        error="Add at least 20 characters."
        helper="Markdown is supported."
      />
    </span>
    <span data-testid="react-warning">
      <Textarea type="warning" label="Notes" />
    </span>
    <span data-testid="react-success">
      <Textarea type="success" label="Notes" />
    </span>
    <span data-testid="react-required">
      <Textarea label="Feedback" required />
    </span>
    <span data-testid="react-disabled">
      <Textarea label="Locked" defaultValue="read-only" disabled />
    </span>
    <span data-testid="react-readonly">
      <Textarea label="Log" defaultValue="line one" readOnly />
    </span>
    <span data-testid="react-size-s">
      <Textarea size="s" label="Small" />
    </span>
    <span data-testid="react-size-l">
      <Textarea size="l" label="Large" />
    </span>
    <span data-testid="react-autoresize">
      <Textarea label="Auto-resize" autoResize rows={2} defaultValue="grows to fit content" />
    </span>
  </StrictMode>,
);
