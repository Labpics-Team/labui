/*
 * Badge parity demo — the React half.
 *
 * Mounts the native-React <Badge> with the SAME specimens as the Lit
 * `<lab-badge>` markup in badge.html, so the Playwright suite can read both
 * renderers' computed styles and assert they match (visual parity, ADR-0001).
 */
import '@labpics/ui-core/badge';
import { Badge } from '@labpics/ui-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in badge.html');

createRoot(mount).render(
  <StrictMode>
    <Badge data-testid="react-brand-fill" color="brand" type="fill">
      Brand
    </Badge>
    <Badge data-testid="react-success-tinted" color="success" type="tinted">
      Active
    </Badge>
    <Badge data-testid="react-danger-fill" color="danger" type="fill">
      3
    </Badge>
    <Badge data-testid="react-neutral-tinted" color="neutral" type="tinted">
      Draft
    </Badge>
    <Badge data-testid="react-static-dark-fill" color="static-dark" type="fill">
      Dark
    </Badge>
    <Badge data-testid="react-static-light-tinted" color="static-light" type="tinted">
      Light
    </Badge>
    <Badge data-testid="react-disabled" color="brand" type="fill" disabled>
      Off
    </Badge>
  </StrictMode>,
);
