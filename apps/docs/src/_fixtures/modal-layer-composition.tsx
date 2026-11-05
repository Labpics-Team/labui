import '@labpics/ui-core/sheet';
import type { LabSheet } from '@labpics/ui-core/sheet';
import { AlertDialog } from '@labpics/ui-react/alert-dialog';
import { Dialog } from '@labpics/ui-react/dialog';
import { Popover } from '@labpics/ui-react/popover';
import { createElement, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const events: Array<{ kind: string; open: boolean }> = [];

/** Внешний немодальный popup отдельно квалифицирует native top-layer API. */
function usePopupTopLayer(open: boolean, kind: 'popup' | 'dialog' | 'alert'): void {
  useLayoutEffect(() => {
    if (!open || kind !== 'popup') return;
    const positioner = document.querySelector<HTMLElement>('.lab-popover-positioner');
    if (!positioner) throw new Error('Не создан внешний portal');
    positioner.popover = 'manual';
    positioner.showPopover();
    return () => {
      if (positioner.matches(':popover-open')) positioner.hidePopover();
    };
  }, [open, kind]);
}

function Consumer({ kind }: { kind: 'popup' | 'dialog' | 'alert' }) {
  const [open, setOpen] = useState(false);
  usePopupTopLayer(open, kind);
  const onOpenChange = (value: boolean) => {
    events.push({ kind, open: value });
    setOpen(value);
  };
  const content = createElement(
    'div',
    {},
    createElement('input', { id: `${kind}-field`, 'aria-label': kind }),
    createElement('input', {
      id: `${kind}-second`,
      'aria-label': `${kind} дополнительные параметры`,
    }),
  );
  if (kind === 'popup') {
    return createElement(Popover, { content, onOpenChange, arrow: false }, 'Настройки popup');
  }
  const Component = kind === 'dialog' ? Dialog : AlertDialog;
  return createElement(Component, { content, onOpenChange, heading: kind }, `Открыть ${kind}`);
}

for (const kind of ['popup', 'dialog', 'alert'] as const) {
  const mount = document.getElementById(`react-${kind}`);
  if (!mount) throw new Error('Не найден контейнер React');
  createRoot(mount).render(createElement(Consumer, { kind }));
}

declare global {
  interface Window {
    modalLayerComposition: { events: typeof events };
  }
}
window.modalLayerComposition = { events };
void (document.getElementById('sheet') as LabSheet).updateComplete.then(() => {
  document.documentElement.setAttribute('data-modal-layer-ready', 'true');
});
