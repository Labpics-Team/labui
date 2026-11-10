import '@labpics/ui-core/sheet';
import * as dialogBehavior from '@labpics/ui-core/behaviors/dialog';
import { useZag } from '@labpics/ui-react';
import { AlertDialog } from '@labpics/ui-react/alert-dialog';
import { Button } from '@labpics/ui-react/button';
import { Dialog, type ModalTriggerProps } from '@labpics/ui-react/dialog';
import { Sheet } from '@labpics/ui-react/sheet';
import { type MouseEvent, StrictMode, createElement, useId } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createComponent } from 'solid-js';
import { render as solidRender } from 'solid-js/web';
import { createApp, h, nextTick } from 'vue';

type Consumer =
  | 'core'
  | 'native'
  | 'vue'
  | 'solid'
  | 'react'
  | 'react-sheet'
  | 'react-alert'
  | 'behavior'
  | 'behavior-null';
type Part = 'default' | 'icon' | 'end';
type Control = 'input' | 'anchor' | 'button' | 'role';
const query = new URLSearchParams(location.search);
const consumerNames: readonly string[] = [
  'core',
  'native',
  'vue',
  'solid',
  'react',
  'react-sheet',
  'react-alert',
  'behavior',
  'behavior-null',
];
const controlNames: readonly string[] = ['input', 'anchor', 'button', 'role'];
const partNames: readonly string[] = ['default', 'icon', 'end'];
const isConsumer = (value: string): value is Consumer => consumerNames.includes(value);
const isControl = (value: string): value is Control => controlNames.includes(value);
const isPart = (value: string): value is Part => partNames.includes(value);
const selectedConsumer = query.get('consumer') ?? 'core';
const selectedControl = query.get('invalid');
const selectedPart = query.get('part') ?? 'default';
if (!isConsumer(selectedConsumer)) throw new Error('Неверный consumer');
if (selectedControl !== null && !isControl(selectedControl)) throw new Error('Неверный control');
if (!isPart(selectedPart)) throw new Error('Неверный label part');
const consumer: Consumer = selectedConsumer;
let initialControl: Control | null = selectedControl;
const initialPart: Part = selectedPart;
const lazy = query.get('lazy') === '1';
const e = createElement;
const events: boolean[] = [];
const failures: string[] = [];
let clicks = 0;
let actions = 0;
let revision = 0;
let inactive = false;
let lastUserRef: HTMLButtonElement | null = null;
let retiredSource: HTMLElement | null = null;
let reactRoot: ReturnType<typeof createRoot> | undefined;
let setBehaviorOpen: ((open: boolean) => void) | undefined;

function mount(): HTMLElement {
  const node = document.getElementById('app');
  if (!node) throw new Error('Не найден app');
  return node;
}

function source(): HTMLElement {
  const node = mount().querySelector('[data-fixture-trigger]');
  if (!(node instanceof HTMLElement)) throw new Error('Не найден opener');
  return node;
}

function nativeTarget(node = source()): HTMLButtonElement | null {
  if (node instanceof HTMLButtonElement) return node;
  // Потребитель использует readonly port владельца, включая ожидание upgrade.
  if (!('interactionTarget' in node)) return null;
  const port = node.interactionTarget;
  return typeof port === 'object' &&
    port !== null &&
    'current' in port &&
    port.current instanceof HTMLButtonElement
    ? port.current
    : null;
}

function control(kind: Control): HTMLElement {
  const node = document.createElement(kind === 'anchor' ? 'a' : kind === 'role' ? 'span' : kind);
  node.setAttribute('data-invalid-control', '');
  if (kind === 'anchor') node.setAttribute('href', '#outside');
  if (kind === 'button') node.setAttribute('type', 'button');
  if (kind === 'role') node.setAttribute('role', 'combobox');
  if (kind !== 'input') node.textContent = 'Вложенный control';
  return node;
}

function icon(part: 'icon' | 'end'): SVGSVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('slot', part);
  node.setAttribute('data-trigger-part', part);
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('width', '24');
  node.setAttribute('height', '24');
  const path = document.createElementNS(node.namespaceURI, 'path');
  path.setAttribute('d', 'M4 4h16v16H4z');
  node.append(path);
  return node;
}

function label(): HTMLSpanElement {
  const node = document.createElement('span');
  node.setAttribute('data-trigger-part', 'default');
  node.append('Настроить ');
  const strong = document.createElement('strong');
  strong.textContent = 'цвет';
  node.append(strong);
  return node;
}

function labelNodes(): Element[] {
  return [icon('icon'), label(), icon('end')];
}

function insertControl(kind: Control, part: Part): void {
  const node = source();
  const bad = control(kind);
  if (node.localName === 'lab-button' && part !== 'default') {
    bad.slot = part;
    node.append(bad);
    return;
  }
  const location = node.querySelector(`[data-trigger-part="${part}"]`);
  if (!location) throw new Error(`Не найден label part ${part}`);
  // SVG получает HTML control в соседней неинтерактивной обёртке.
  if (location instanceof SVGElement) location.after(bad);
  else location.append(bad);
}

function makeSource(native = false): HTMLElement {
  const node = document.createElement(native ? 'button' : 'lab-button');
  node.slot = 'trigger';
  node.setAttribute('data-fixture-trigger', '');
  node.setAttribute('data-revision', String(revision));
  node.setAttribute('type', native ? 'button' : 'neutral');
  if (!native) node.setAttribute('kind', 'border');
  node.append(...labelNodes());
  node.addEventListener('click', () => clicks++);
  return node;
}

function body(): HTMLDivElement {
  const node = document.createElement('div');
  node.slot = 'content';
  const field = document.createElement('input');
  field.id = 'field';
  field.setAttribute('aria-label', 'Поле панели');
  const apply = document.createElement('button');
  apply.id = 'apply';
  apply.type = 'button';
  apply.textContent = 'Применить';
  apply.addEventListener('click', () => actions++);
  node.append(field, apply);
  return node;
}

function reactControl() {
  const props = { 'data-invalid-control': '' };
  if (initialControl === 'role') return e('span', { ...props, role: 'combobox' }, 'Control');
  if (initialControl === 'anchor') return e('a', { ...props, href: '#outside' }, 'Control');
  if (initialControl === 'button') return e('button', { ...props, type: 'button' }, 'Control');
  return e('input', props);
}

function reactIcon(part: 'icon' | 'end') {
  return e(
    'span',
    { 'data-trigger-part': part },
    e('svg', { width: 24, height: 24, 'aria-hidden': true }, e('path', { d: 'M4 4h16v16H4z' })),
    initialControl && initialPart === part ? reactControl() : null,
  );
}

function renderCustomTrigger({ props, ref }: ModalTriggerProps) {
  return e(
    Button,
    {
      ...props,
      key: revision,
      type: 'neutral',
      kind: 'border',
      loading: inactive,
      ref: (node: HTMLButtonElement | null) => {
        node?.setAttribute('data-fixture-trigger', '');
        node?.setAttribute('data-revision', String(revision));
        lastUserRef = node;
        ref(node);
      },
      onClick: (event) => {
        clicks++;
        props.onClick?.(event);
      },
      iconSlot: reactIcon('icon'),
      endSlot: reactIcon('end'),
    },
    e(
      'span',
      { 'data-trigger-part': 'default' },
      'Настроить ',
      e('strong', {}, 'цвет'),
      initialControl && initialPart === 'default' ? reactControl() : null,
    ),
  );
}

function renderReact(): void {
  if (!reactRoot) throw new Error('Не создан React root');
  const component =
    consumer === 'react-sheet' ? Sheet : consumer === 'react-alert' ? AlertDialog : Dialog;
  flushSync(() =>
    reactRoot?.render(
      e(
        StrictMode,
        {},
        e(component, {
          heading: 'Параметры цвета',
          trigger: renderCustomTrigger,
          onOpenChange: (open: boolean) => events.push(open),
          content: e(
            'div',
            {},
            e('input', { id: 'field', 'aria-label': 'Поле панели' }),
            e('button', { id: 'apply', type: 'button', onClick: () => actions++ }, 'Применить'),
          ),
        }),
      ),
    ),
  );
}

/** Настоящий публичный behavior consumer сохраняет штатный путь без DOM getter. */
function BehaviorConsumer() {
  const api = useZag(dialogBehavior, {
    id: useId(),
    modal: !query.has('nonmodal'),
    closeOnInteractOutside: true,
    triggerEl: consumer === 'behavior-null' ? () => null : undefined,
    onOpenChange: (details) => events.push(details.open),
  });
  setBehaviorOpen = api.setOpen;
  const triggerProps = api.getTriggerProps();
  return e(
    'div',
    {},
    e(
      'button',
      {
        ...triggerProps,
        'data-fixture-trigger': '',
        onClick: (event: MouseEvent<HTMLButtonElement>) => {
          clicks++;
          if (consumer !== 'behavior-null') triggerProps.onClick?.(event);
        },
      },
      'Настроить цвет',
    ),
    e(
      'div',
      { ...api.getContentProps(), hidden: !api.open },
      e('input', { id: 'field', 'aria-label': 'Поле панели' }),
      e('button', { id: 'apply', type: 'button', onClick: () => actions++ }, 'Применить'),
    ),
  );
}

async function settle(): Promise<void> {
  const button = source();
  if ('updateComplete' in button) {
    try {
      await button.updateComplete;
    } catch (error) {
      failures.push(String(error));
    }
  }
  const modal = document.getElementById('modal');
  if (modal && 'updateComplete' in modal) {
    try {
      await modal.updateComplete;
    } catch (error) {
      failures.push(String(error));
    }
  }
}

async function start(): Promise<void> {
  if (consumer === 'behavior' || consumer === 'behavior-null') {
    reactRoot = createRoot(mount());
    flushSync(() => reactRoot?.render(e(StrictMode, {}, e(BehaviorConsumer))));
  } else if (consumer.startsWith('react')) {
    reactRoot = createRoot(mount());
    renderReact();
  } else if (consumer === 'vue') {
    const [{ Sheet: VueSheet }, { Button: VueButton }] = await Promise.all([
      import('@labpics/ui-vue/sheet'),
      import('@labpics/ui-vue/button'),
    ]);
    createApp({
      setup: () => () =>
        h(
          VueSheet,
          {
            id: 'modal',
            position: 'half',
            'aria-label': 'Параметры цвета',
            onOpenChange: (event: CustomEvent<{ open: boolean }>) => events.push(event.detail.open),
          },
          {
            trigger: () =>
              h(
                VueButton,
                {
                  'data-fixture-trigger': '',
                  type: 'neutral',
                  kind: 'border',
                  onClick: () => clicks++,
                },
                {
                  default: () =>
                    h('span', { 'data-trigger-part': 'default' }, [
                      'Настроить ',
                      h('strong', {}, 'цвет'),
                    ]),
                  icon: () =>
                    h(
                      'svg',
                      { 'data-trigger-part': 'icon', 'aria-hidden': true, width: 24, height: 24 },
                      [h('path', { d: 'M4 4h16v16H4z' })],
                    ),
                  end: () =>
                    h(
                      'svg',
                      { 'data-trigger-part': 'end', 'aria-hidden': true, width: 24, height: 24 },
                      [h('path', { d: 'M4 4h16v16H4z' })],
                    ),
                },
              ),
            content: () =>
              h('div', {}, [
                h('input', { id: 'field', 'aria-label': 'Поле панели' }),
                h('button', { id: 'apply', type: 'button', onClick: () => actions++ }, 'Применить'),
              ]),
          },
        ),
    }).mount(mount());
    if (initialControl) insertControl(initialControl, initialPart);
    await nextTick();
  } else if (consumer === 'solid') {
    const [{ Sheet: SolidSheet }, { Button: SolidButton }] = await Promise.all([
      import('@labpics/ui-solid/sheet'),
      import('@labpics/ui-solid/button'),
    ]);
    solidRender(
      () =>
        createComponent(SolidSheet, {
          id: 'modal',
          position: 'half',
          'aria-label': 'Параметры цвета',
          onOpenChange: (event: CustomEvent<{ open: boolean }>) => events.push(event.detail.open),
          children: [
            createComponent(SolidButton, {
              slot: 'trigger',
              type: 'neutral',
              kind: 'border',
              ref: (node: HTMLElement) => node.setAttribute('data-fixture-trigger', ''),
              onClick: () => clicks++,
              children: labelNodes(),
            }),
            body(),
          ],
        }),
      mount(),
    );
    if (initialControl) insertControl(initialControl, initialPart);
  } else {
    if (consumer !== 'native' && !lazy) await import('@labpics/ui-core/button');
    const modal = document.createElement('lab-sheet');
    modal.id = 'modal';
    modal.position = 'half';
    if (query.get('closable') === '1') modal.closable = true;
    modal.setAttribute('aria-label', 'Параметры цвета');
    modal.addEventListener('open-change', (event) => {
      if (event instanceof CustomEvent) events.push(event.detail.open);
    });
    modal.append(makeSource(consumer === 'native'), body());
    mount().append(modal);
    if (initialControl) insertControl(initialControl, initialPart);
  }
  await settle();
  document.documentElement.setAttribute('data-trigger-ready', 'true');
}

declare global {
  interface Window {
    modalTriggerComposition: {
      state(): {
        consumer: string;
        clicks: number;
        actions: number;
        events: boolean[];
        failures: string[];
        controls: number;
        buttonType: string | null;
        userRefMatches: boolean;
        retiredConnected: boolean;
      };
      upgradeButton(): Promise<void>;
      openControlled(): Promise<void>;
      replaceTrigger(): Promise<void>;
      setInactive(value: boolean): Promise<void>;
      insertControl(kind: Control, part: Part): void;
      appendAndActivate(kind: Control, part: Part): void;
      openAndRevoke(): void;
      recover(): void;
    };
  }
}

window.modalTriggerComposition = {
  state() {
    const target = nativeTarget();
    const references: unknown = target ? Reflect.get(target, 'ariaControlsElements') : undefined;
    return {
      consumer,
      clicks,
      actions,
      events: [...events],
      failures: [...failures],
      controls: Array.isArray(references) ? references.length : 0,
      buttonType: target?.type ?? null,
      userRefMatches: lastUserRef === target,
      retiredConnected: retiredSource ? nativeTarget(retiredSource)?.isConnected === true : false,
    };
  },
  async upgradeButton() {
    await import('@labpics/ui-core/button');
    await settle();
  },
  async openControlled() {
    if (setBehaviorOpen) setBehaviorOpen(true);
    else {
      const modal = document.getElementById('modal');
      if (!modal || !('open' in modal)) throw new Error('Consumer не поддерживает controlled open');
      modal.open = true;
      await settle();
    }
  },
  async replaceTrigger() {
    const previous = source();
    retiredSource = previous;
    revision++;
    if (reactRoot) renderReact();
    else previous.replaceWith(makeSource(consumer === 'native'));
    // Старый opener остаётся подключённым независимым действием страницы.
    previous.removeAttribute('id');
    document.getElementById('retired')?.append(previous);
    await settle();
  },
  async setInactive(value) {
    inactive = value;
    if (reactRoot) renderReact();
    else {
      const button = source();
      if (button instanceof HTMLButtonElement) button.disabled = value;
      else if ('loading' in button) button.loading = value;
    }
    await settle();
  },
  insertControl,
  appendAndActivate(kind, part) {
    const target = nativeTarget();
    insertControl(kind, part);
    target?.click();
  },
  openAndRevoke() {
    const target = nativeTarget();
    const label = source().querySelector('[data-trigger-part="default"]');
    if (!target || !label) throw new Error('Не найден opener или его подпись');
    target.focus();
    target.click();
    // Ни microtask, ни RAF не исполняется между кликом и отзывом.
    label.setAttribute('role', 'combobox');
  },
  recover() {
    initialControl = null;
    if (reactRoot) renderReact();
    for (const node of source().querySelectorAll('[data-invalid-control]')) node.remove();
  },
};

void start();
