import '@labpics/ui-core/sheet';
import { AlertDialog } from '@labpics/ui-react/alert-dialog';
import { Dialog } from '@labpics/ui-react/dialog';
import { StrictMode, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';

const scenario = new URLSearchParams(location.search).get('scenario') ?? 'sheet';
const events: Array<{ kind: string; open: boolean }> = [];
const actions: string[] = [];
const e = createElement;

function Child({ kind, remove }: { kind: 'dialog' | 'alert'; remove: () => void }) {
  const [revision, setRevision] = useState(0);
  return e(
    kind === 'dialog' ? Dialog : AlertDialog,
    {
      heading: kind === 'dialog' ? 'Параметры ребёнка' : 'Подтверждение ребёнка',
      onOpenChange: (open: boolean) => events.push({ kind, open }),
      content: e(
        'div',
        {},
        e('label', {}, `Поле ${kind}`, e('input', { id: `${kind}-field` })),
        e(
          'button',
          {
            type: 'button',
            id: `${kind}-apply`,
            onClick: () => {
              actions.push(kind);
              setRevision((value) => value + 1);
            },
          },
          `Применить ${kind}`,
        ),
        e('output', { id: `${kind}-result` }, `Применено ${revision}`),
        e('button', { type: 'button', id: `${kind}-remove`, onClick: remove }, 'Убрать Sheet'),
      ),
    },
    `Открыть ${kind}`,
  );
}

function SheetConsumer() {
  const [present, setPresent] = useState(true);
  if (!present) return e('p', { id: 'sheet-removed' }, 'Sheet удалён');
  return e(
    'lab-sheet',
    { id: 'sheet', 'data-testid': 'sheet', position: 'half', 'aria-label': 'Панель Sheet' },
    'Открыть Sheet',
    e(
      'div',
      { slot: 'content', id: 'sheet-body' },
      e('label', {}, 'Поле Sheet', e('input', { id: 'sheet-field' })),
      e(
        'button',
        { type: 'button', id: 'sheet-apply', onClick: () => actions.push('sheet') },
        'Применить Sheet',
      ),
      e(Child, { kind: 'dialog', remove: () => setPresent(false) }),
      e(Child, { kind: 'alert', remove: () => setPresent(false) }),
    ),
  );
}

function Outer() {
  return e(
    Dialog,
    {
      heading: 'Родитель React',
      onOpenChange: (open: boolean) => events.push({ kind: 'outer', open }),
      content: e(
        'div',
        {},
        e('label', {}, 'Поле родителя', e('input', { id: 'outer-field' })),
        e(
          'button',
          { type: 'button', id: 'outer-apply', onClick: () => actions.push('outer') },
          'Применить родителя',
        ),
        scenario === 'react' ? null : e(SheetConsumer),
      ),
    },
    'Открыть родителя',
  );
}

let mount = document.getElementById('app');
if (!mount) throw new Error('Не найден контейнер потребителя');
if (scenario === 'shadow') {
  // Собственная оболочка потребителя проверяет ещё две границы ShadowRoot.
  for (let depth = 0; depth < 2; depth++) {
    const root = mount.attachShadow({ mode: 'open' });
    const background = document.createElement('button');
    background.textContent = `Фон оболочки ${depth}`;
    const child = document.createElement('div');
    root.append(background, child);
    mount = child;
  }
}
createRoot(mount).render(
  e(StrictMode, {}, e(scenario === 'triple' || scenario === 'react' ? Outer : SheetConsumer)),
);

declare global {
  interface Window {
    modalPublicComposition: { events: typeof events; actions: typeof actions };
  }
}
window.modalPublicComposition = { events, actions };
