/*
 * Kbd parity demo — the React half. Mounts the native-React <Kbd> with the SAME
 * specimens as the Lit `<lab-kbd>` markup in kbd.html for the parity suite.
 */
import '@labpics/ui-core/kbd';
import { Kbd } from '@labpics/ui-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in kbd.html');

createRoot(mount).render(
  <StrictMode>
    <Kbd data-testid="react-s" size="s">
      Esc
    </Kbd>
    <Kbd data-testid="react-m" size="m">
      ⌘
    </Kbd>
    <Kbd data-testid="react-l" size="l">
      Enter
    </Kbd>
  </StrictMode>,
);
