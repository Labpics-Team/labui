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
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in textarea.html');

function FormSpecimens() {
  const [value, setValue] = useState('Initial');
  const [disabled, setDisabled] = useState(false);
  return (
    <>
      <form data-testid="react-form" onSubmit={(event) => event.preventDefault()}>
        <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <Textarea label="Form notes" name="notes" defaultValue="Initial" autoResize rows={2} />
        </fieldset>
        <button type="reset">Reset notes</button>
        <button type="button" onClick={() => setDisabled(!disabled)}>
          Toggle disabled
        </button>
      </form>
      <span data-testid="react-controlled">
        <Textarea
          label="Controlled notes"
          value={value}
          onValueChange={setValue}
          autoResize
          rows={2}
        />
        <button
          type="button"
          onClick={() => setValue(Array.from({ length: 10 }, (_, i) => `Line ${i}`).join('\n'))}
        >
          Replace notes
        </button>
        <button type="button" onClick={() => setValue('')}>
          Clear notes
        </button>
      </span>
    </>
  );
}

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
    <FormSpecimens />
  </StrictMode>,
);
