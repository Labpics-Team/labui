/*
 * Card parity demo — the React half.
 *
 * Mounts the native-React <Card> with the SAME specimens as the Lit `<lab-card>`
 * markup in card.html, so the Playwright suite can read both renderers' computed
 * styles (visual parity, ADR-0001) and their shared native semantics (an <article>
 * surface, header / footer landmarks).
 *
 * It registers the Lit element (side-effect import) and wires the theme switcher,
 * so the page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/card';
import { Card } from '@labpics/ui-react/card';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in card.html');

createRoot(mount).render(
  <StrictMode>
    <div data-testid="react-cards" className="specimens">
      <Card data-testid="react-elevated" variant="elevated" header="Elevated" footer="Footer">
        A raised surface that floats above the page.
      </Card>
      <Card data-testid="react-outlined" variant="outlined" header="Outlined" footer="Footer">
        A flat surface delineated by a real border.
      </Card>
      <Card
        data-testid="react-filled"
        variant="filled"
        interactive
        header="Filled · interactive"
        footer="Footer"
      >
        A tinted surface that recedes; hoverable as a whole-card target.
      </Card>
      {/*
       * INTERACTIVE with a real focusable control — the twin of the Lit specimen.
       * The card flags interactive-without-keyboard as a P5 a11y trap; the
       * actionable semantics stay on a real <button> in the body (the <article>
       * never fabricates a role). :focus-within draws --lab-border-focus.
       */}
      <Card
        data-testid="react-interactive"
        variant="elevated"
        interactive
        header="Interactive"
        footer="Footer"
      >
        A whole-card target whose action is a real control.{' '}
        <button type="button" data-testid="react-interactive-control">
          Open
        </button>
      </Card>
    </div>
  </StrictMode>,
);
