import '@labpics/ui-core/sheet';
import type { LabSheet } from '@labpics/ui-core/sheet';
import { Sheet as SolidSheet } from '@labpics/ui-solid/sheet';
import { Sheet as VueSheet } from '@labpics/ui-vue/sheet';
import { html, render as litRender } from 'lit';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createComponent } from 'solid-js';
import { render as solidRender, spread } from 'solid-js/web';
import { createApp, h } from 'vue';

type Consumer = 'lit' | 'vue' | 'solid' | 'react';
const consumers: Consumer[] = ['lit', 'vue', 'solid', 'react'];
const counters = { lit: 0, vue: 0, solid: 0, react: 0 };
const bodies = new Map<Consumer, HTMLElement>();
const parents = new Map<Consumer, Node>();

function mount(id: Consumer): HTMLElement {
  const target = document.getElementById(`${id}-app`);
  if (!target) throw new Error(`Не найден контейнер ${id}`);
  return target;
}

function remember(id: Consumer): void {
  document.getElementById(id)?.setAttribute('data-testid', id);
  const body = document.getElementById(`${id}-body`);
  if (!body?.parentNode) throw new Error(`Не найден consumer body ${id}`);
  bodies.set(id, body);
  parents.set(id, body.parentNode);
}

litRender(
  html`
    <lab-sheet id="lit" data-testid="lit" position="flex" aria-label="Уведомления Lit">
      Открыть Lit
      <form id="lit-body" class="consumer-body" slot="content">
        <label>Имя <input id="lit-name" value="Даниил" /></label>
        <button id="lit-action" type="button" @click=${() => counters.lit++}>Сохранить</button>
      </form>
    </lab-sheet>
  `,
  mount('lit'),
);
remember('lit');

createApp({
  setup: () => () =>
    h(
      VueSheet,
      { id: 'vue', 'data-testid': 'vue', position: 'flex', 'aria-label': 'Уведомления Vue' },
      {
        default: () => 'Открыть Vue',
        content: () =>
          h('form', { id: 'vue-body', class: 'consumer-body', 'data-v-consumer': '' }, [
            h('label', {}, ['Имя ', h('input', { id: 'vue-name', value: 'Даниил' })]),
            h(
              'button',
              { id: 'vue-action', type: 'button', onClick: () => counters.vue++ },
              'Сохранить',
            ),
          ]),
      },
    ),
}).mount(mount('vue'));
remember('vue');

solidRender(() => {
  const body = document.createElement('form');
  body.id = 'solid-body';
  body.className = 'consumer-body';
  body.slot = 'content';
  const label = document.createElement('label');
  label.textContent = 'Имя ';
  const input = document.createElement('input');
  input.id = 'solid-name';
  input.value = 'Даниил';
  label.append(input);
  const action = document.createElement('button');
  action.id = 'solid-action';
  action.type = 'button';
  action.textContent = 'Сохранить';
  spread(action, { onClick: () => counters.solid++ });
  body.append(label, action);
  return createComponent(SolidSheet, {
    id: 'solid',
    position: 'flex',
    'aria-label': 'Уведомления Solid',
    children: ['Открыть Solid', body],
  });
}, mount('solid'));
remember('solid');

const reactRoot = createRoot(mount('react'));
function renderReact(revision: number): void {
  flushSync(() =>
    reactRoot.render(
      createElement(
        'lab-sheet',
        {
          id: 'react',
          'data-testid': 'react',
          position: 'flex',
          'aria-label': 'Уведомления React',
        },
        'Открыть React',
        createElement(
          'form',
          { id: 'react-body', className: 'consumer-body', slot: 'content', key: revision },
          createElement('label', {}, [
            'Имя ',
            createElement('input', { id: 'react-name', defaultValue: 'Даниил', key: 'input' }),
          ]),
          createElement(
            'button',
            { id: 'react-action', type: 'button', onClick: () => counters.react++ },
            revision ? 'Сохранить заново' : 'Сохранить',
          ),
        ),
      ),
    ),
  );
}
renderReact(0);
remember('react');

declare global {
  interface Window {
    modalCompositionFixture: {
      counters: typeof counters;
      inspect(id: Consumer): {
        documentOwned: boolean;
        parentPreserved: boolean;
        background: string;
        minHeight: string;
        padding: string;
        border: string;
        marginTop: string;
        borderBottom: string;
        height: number;
      };
      replaceReactBody(): Promise<void>;
      originalReactBodyConnected(): boolean;
    };
  }
}

window.modalCompositionFixture = {
  counters,
  inspect(id) {
    const body = bodies.get(id);
    if (!body) throw new Error(`Не сохранён consumer body ${id}`);
    const style = getComputedStyle(body);
    return {
      documentOwned: body.getRootNode() === document,
      parentPreserved: body.parentNode === parents.get(id),
      background: style.backgroundColor,
      minHeight: style.minHeight,
      padding: style.padding,
      border: style.borderTopWidth,
      marginTop: style.marginTop,
      borderBottom: style.borderBottomWidth,
      height: body.getBoundingClientRect().height,
    };
  },
  async replaceReactBody() {
    renderReact(1);
    await (document.getElementById('react') as LabSheet).updateComplete;
  },
  originalReactBodyConnected: () => bodies.get('react')?.isConnected === true,
};

async function ready(): Promise<void> {
  await Promise.all(
    consumers.map((id) => (document.getElementById(id) as LabSheet).updateComplete),
  );
  document.documentElement.setAttribute('data-modal-composition-ready', 'true');
}
void ready();
