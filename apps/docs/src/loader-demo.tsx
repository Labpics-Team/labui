/*
 * Loader parity demo — the React half. Mounts the native-React <Loader> with the
 * SAME specimens as the Lit `<lab-loader>` markup in loader.html for the parity
 * suite.
 */
import '@labpics/ui-core/loader';
import { Loader } from '@labpics/ui-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in loader.html');

createRoot(mount).render(
  <StrictMode>
    <Loader data-testid="react-s" size="s" />
    <Loader data-testid="react-m" size="m" />
    <Loader data-testid="react-l" size="l" label="Saving changes" />
  </StrictMode>,
);
