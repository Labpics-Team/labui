import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@labpics/ui-tokens/motion.css';
import type { LabSwitch } from '@labpics/ui-core/switch';
import { Switch } from '@labpics/ui-react/switch';
import { StrictMode, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot, hydrateRoot } from 'react-dom/client';

type Renderer = 'lit' | 'react';
type Size = 's' | 'm' | 'l';

interface SwitchMotionFixture {
  thumb(renderer: Renderer): HTMLElement;
  input(renderer: Renderer): HTMLInputElement;
  toggle(renderer: Renderer): Promise<void>;
  size(renderer: Renderer, size: Size): Promise<void>;
  detach(renderer: Renderer): HTMLElement;
  reconnect(renderer: Renderer): Promise<void>;
}

declare global {
  interface Window {
    switchMotionFixture: SwitchMotionFixture;
  }
}

const lit = document.querySelector<LabSwitch>('[data-testid="lit-motion"]');
const litMount = document.querySelector<HTMLElement>('#lit-mount');
const reactMount = document.querySelector<HTMLElement>('#react-motion');
const initial = document.querySelector<HTMLElement>('#react-initial');
if (!lit || !litMount || !reactMount || !initial) throw new Error('Нет узлов Switch fixture');

let checked = false;
let currentSize: Size = 'm';
let updateSize: ((size: Size) => void) | undefined;
let reactRoot: Root;
let mounted: (() => void) | undefined;
let stateCommitted: ((checked: boolean) => void) | undefined;

function ReactFixture() {
  const [value, setValue] = useState(checked);
  const [size, setSize] = useState(currentSize);
  useLayoutEffect(() => {
    stateCommitted?.(value);
  }, [value]);
  useLayoutEffect(() => {
    const state = document.documentElement.dataset;
    state.strictMounts = String(Number(state.strictMounts ?? 0) + 1);
    updateSize = setSize;
    mounted?.();
    return () => {
      state.strictCleanups = String(Number(state.strictCleanups ?? 0) + 1);
      updateSize = undefined;
    };
  }, []);
  return (
    <Switch
      checked={value}
      size={size}
      onCheckedChange={(next) => {
        checked = next;
        // Zag доставляет событие в microtask: синхронным должен быть сам commit.
        flushSync(() => setValue(next));
      }}
    >
      Уведомления
    </Switch>
  );
}

async function mountReact(): Promise<void> {
  const ready = new Promise<void>((resolve) => {
    mounted = resolve;
  });
  reactRoot = createRoot(reactMount as HTMLElement);
  reactRoot.render(
    <StrictMode>
      <ReactFixture />
    </StrictMode>,
  );
  await ready;
  mounted = undefined;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function select<T extends HTMLElement>(renderer: Renderer, selector: string): T {
  const container = renderer === 'lit' ? lit?.shadowRoot : reactMount;
  const element = container?.querySelector<T>(selector);
  if (!element) throw new Error(`Нет ${renderer} ${selector}`);
  return element;
}

window.switchMotionFixture = {
  thumb: (renderer) => select(renderer, renderer === 'lit' ? '.thumb' : '.lab-switch-thumb'),
  input: (renderer) => select<HTMLInputElement>(renderer, 'input'),
  async toggle(renderer) {
    if (renderer === 'react') {
      const expected = !select<HTMLInputElement>(renderer, 'input').checked;
      const complete = new Promise<void>((resolve) => {
        stateCommitted = (value) => {
          if (value === expected) resolve();
        };
      });
      select<HTMLInputElement>(renderer, 'input').click();
      await complete;
      stateCommitted = undefined;
    } else {
      select<HTMLInputElement>(renderer, 'input').click();
      await lit.updateComplete;
      await lit.updateComplete;
    }
  },
  async size(renderer, size) {
    if (renderer === 'lit') {
      lit.size = size;
      await lit.updateComplete;
    } else {
      currentSize = size;
      updateSize?.(size);
      await nextFrame();
    }
  },
  detach(renderer) {
    const thumb = this.thumb(renderer);
    if (renderer === 'lit') lit.remove();
    else reactRoot.unmount();
    return thumb;
  },
  async reconnect(renderer) {
    if (renderer === 'lit') {
      litMount.append(lit);
      await lit.updateComplete;
    } else await mountReact();
    await nextFrame();
  },
};

async function start() {
  // Hydration support должен выполниться до создания класса Lit, в том числе
  // при вынесении зависимостей bundler в отдельный chunk.
  await import('@labpics/ui-core/switch');
  const initialThumb = initial?.querySelector('.lab-switch-thumb');
  hydrateRoot(
    initial as HTMLElement,
    <StrictMode>
      <Switch checked>Изначально включено</Switch>
    </StrictMode>,
  );
  await mountReact();
  await lit?.updateComplete;
  await nextFrame();
  if (initial) {
    initial.dataset.nodePreserved = String(
      initial.querySelector('.lab-switch-thumb') === initialThumb,
    );
  }
  document.documentElement.dataset.motionFixtureReady = 'true';
}
void start();
