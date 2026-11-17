import '@labpics/ui-core/snackbar';
import type { LabSnackbar } from '@labpics/ui-core/snackbar';
import { Snackbar } from '@labpics/ui-react/snackbar';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Renderer = 'lit' | 'react';
interface Control {
  show(duration?: number, message?: string): void;
  hide(): void;
  dispose(): void;
  closed: number;
  actions: number;
}
declare global {
  interface Window {
    snackbarControls: Partial<Record<Renderer, Control>>;
  }
}
window.snackbarControls = {};
const field = document.querySelector<LabSnackbar>('lab-snackbar');
if (!field) throw new Error('Missing Lit Snackbar');
const lit: Control = {
  closed: 0,
  actions: 0,
  show(duration = 5000, message = 'The file.png was deleted') {
    field.duration = duration;
    field.message = message;
    field.notificationKey = Number(field.notificationKey ?? 0) + 1;
    field.open = true;
  },
  hide() {
    field.open = false;
  },
  dispose() {
    field.remove();
  },
};
window.snackbarControls.lit = lit;
field.addEventListener('lab-open-change', () => lit.closed++);
field.addEventListener('lab-action', () => lit.actions++);
document.querySelector('#show-lit')?.addEventListener('click', () => lit.show());

function Example() {
  const [state, setState] = useState({
    open: false,
    duration: 5000,
    message: 'The file.png was deleted',
    notificationKey: 0,
  });
  const [control] = useState<Control>(() => ({
    closed: 0,
    actions: 0,
    show(duration = 5000, message = 'The file.png was deleted') {
      setState((previous) => ({
        open: true,
        duration,
        message,
        notificationKey: previous.notificationKey + 1,
      }));
    },
    hide() {
      setState((previous) => ({ ...previous, open: false }));
    },
    dispose() {
      mountedReact.unmount();
    },
  }));
  useEffect(() => {
    window.snackbarControls.react = control;
  }, [control]);
  return (
    <>
      <button id="show-react" type="button" onClick={() => control.show()}>
        Показать React
      </button>
      <Snackbar
        {...state}
        actionLabel="Undo"
        onOpenChange={(open) => {
          control.closed++;
          setState((previous) => ({ ...previous, open }));
        }}
        onAction={() => {
          control.actions++;
        }}
      />
    </>
  );
}
const reactRoot = document.querySelector('#react-root');
if (!reactRoot) throw new Error('Missing React root');
const mountedReact = createRoot(reactRoot);
mountedReact.render(
  <StrictMode>
    <Example />
  </StrictMode>,
);
