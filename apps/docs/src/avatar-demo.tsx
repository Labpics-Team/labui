/*
 * Avatar parity demo — the React half. Mounts the native-React <Avatar> with the
 * SAME specimens as the Lit `<lab-avatar>` markup in avatar.html for the parity
 * suite. Specimens use the honest initials fallback (a name, no image).
 */
import '@labpics/ui-core/avatar';
import { Avatar } from '@labpics/ui-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in avatar.html');

createRoot(mount).render(
  <StrictMode>
    <Avatar data-testid="react-brand-online" color="brand" status="online" name="Ada Lovelace" />
    <Avatar data-testid="react-success-away" color="success" status="away" name="Grace Hopper" />
    <Avatar data-testid="react-danger-dnd" color="danger" status="dnd" name="Alan Turing" />
    <Avatar
      data-testid="react-neutral-offline"
      color="neutral"
      status="offline"
      name="Katherine Johnson"
    />
    <Avatar data-testid="react-anon" color="neutral" status="none" />
  </StrictMode>,
);
