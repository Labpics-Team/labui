import '@labui/colors/contract.css';
import config from '@labui/colors/labui.config.json' with { type: 'json' };
import roles from '@labui/colors/roles.json' with { type: 'json' };
import {
  type LabuiColorsAttachment,
  type LabuiColorsState,
  attachLabuiColors,
} from '@labui/colors/runtime';

type ScopeKey = 'root' | 'nested' | 'shadow';

interface Snapshot {
  state: LabuiColorsState['state'];
  reason: string | null;
  revision: string | null;
  snapshotVersion?: number;
  outputCount?: number;
  properties: Record<string, string>;
  populated: number;
  propertyCount: number;
  sheetCount: number;
}

interface LiveColorsFixture {
  ready: Promise<void>;
  initial: Record<ScopeKey, Snapshot>;
  partialFrames: Array<{ scope: ScopeKey; populated: number; expected: number }>;
  initialBootMs: Partial<Record<ScopeKey, number>>;
  read(scope: ScopeKey): Snapshot;
  refresh(scope: ScopeKey): Promise<Snapshot>;
  cancel(scope: ScopeKey): Snapshot;
  dispose(scope: ScopeKey): Snapshot;
  mount(scope: ScopeKey): Promise<Snapshot>;
  damage(scope: ScopeKey): void;
  probeLifecycle(action: 'cancel' | 'dispose'): Promise<{
    stopped: LabuiColorsState['state'];
    states: LabuiColorsState['state'][];
    masked: boolean;
    hasScope: boolean;
    restored: LabuiColorsState['state'];
    populated: number;
  }>;
  probeFrameSampling(): Promise<{
    initial: string;
    commits: Array<{ tone: string; populated: number }>;
    stableCommits: number;
    propertyCount: number;
  }>;
  probePublisherReentry(
    origin: 'listener' | 'callback',
    action: 'cancel' | 'dispose' | 'none',
  ): Promise<{
    ready: LabuiColorsState['state'];
    state: LabuiColorsState['state'];
    attribute: string | null;
    events: LabuiColorsState['state'][];
    callbacks: LabuiColorsState['state'][];
  }>;
  measureRoot(
    count: number,
  ): Promise<{ elapsedMs: number[]; propertyCount: number; outputCount?: number }>;
}

declare global {
  interface Window {
    __labColorsLive?: LiveColorsFixture;
  }
}

const required = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Не найдена область ${id}`);
  return element;
};

const shadowHost = required('colors-shadow-host');
const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
shadowRoot.innerHTML = `
  <style>
    #shadow-backdrop { padding: 12px; background: rgb(0 0 0); }
    #colors-shadow { padding: 12px; background: var(--lab-bg-secondary); color: var(--lab-label-primary); }
  </style>
  <div id="shadow-backdrop"><section id="colors-shadow"><h2>ShadowRoot</h2></section></div>
`;
const shadowScope = shadowRoot.querySelector<HTMLElement>('#colors-shadow');
const shadowBackdrop = shadowRoot.querySelector<HTMLElement>('#shadow-backdrop');
if (!shadowScope || !shadowBackdrop) throw new Error('Не найдена область ShadowRoot');

const scopes: Record<ScopeKey, HTMLElement> = {
  root: required('colors-root'),
  nested: required('colors-nested'),
  shadow: shadowScope,
};
const backdrops: Record<ScopeKey, HTMLElement> = {
  root: required('root-backdrop'),
  nested: required('nested-backdrop'),
  shadow: shadowBackdrop,
};
const names = [...new Set(Object.values(roles.groups).flat())].sort();
const keys: ScopeKey[] = ['root', 'nested', 'shadow'];
const original = structuredClone(config);
// Это явная физика авторского слоя. Математика и поиск остаются у пакета Colors.
const authored = {
  ...original,
  themes: {
    light: { ...original.themes.light, backgroundOpacity: 0 },
    dark: { ...original.themes.dark, backgroundOpacity: 0 },
  },
};
const attachments = new Map<ScopeKey, LabuiColorsAttachment>();
const initialBootMs: LiveColorsFixture['initialBootMs'] = {};

function read(key: ScopeKey): Snapshot {
  const scope = scopes[key];
  const state = attachments.get(key)?.state;
  if (!state) throw new Error(`Область ${key} не подключена`);
  const style = getComputedStyle(scope);
  const properties = Object.fromEntries(
    names.map((name) => [name, style.getPropertyValue(name).trim()]),
  );
  const root = scope.getRootNode() as Document | ShadowRoot;
  return {
    state: state.state,
    reason: state.reason,
    revision: state.revision === null ? null : String(state.revision),
    snapshotVersion: state.snapshotVersion,
    outputCount: state.outputCount,
    properties,
    populated: Object.values(properties).filter(Boolean).length,
    propertyCount: names.length,
    sheetCount: root.adoptedStyleSheets.length,
  };
}

function mount(key: ScopeKey) {
  const previous = attachments.get(key);
  if (previous && previous.state.state !== 'disposed') previous.dispose();
  const startedAt = performance.now();
  const attachment = attachLabuiColors({
    scope: scopes[key],
    backdrop: backdrops[key],
    config: authored,
    onState(state) {
      if (state.state === 'ready' && initialBootMs[key] === undefined) {
        initialBootMs[key] = performance.now() - startedAt;
      }
    },
  });
  attachments.set(key, attachment);
  return attachment;
}

for (const key of keys) mount(key);
const initial = Object.fromEntries(keys.map((key) => [key, read(key)])) as Record<
  ScopeKey,
  Snapshot
>;
const partialFrames: LiveColorsFixture['partialFrames'] = [];
let recording = true;
const sample = () => {
  if (!recording) return;
  for (const key of keys) {
    if (attachments.get(key)?.state.state === 'disposed') continue;
    const snapshot = read(key);
    if (
      snapshot.populated > 0 &&
      snapshot.populated !== snapshot.propertyCount &&
      partialFrames.length < 32
    ) {
      partialFrames.push({
        scope: key,
        populated: snapshot.populated,
        expected: snapshot.propertyCount,
      });
    }
  }
  requestAnimationFrame(sample);
};
requestAnimationFrame(sample);
window.addEventListener(
  'pagehide',
  () => {
    recording = false;
  },
  { once: true },
);

window.__labColorsLive = {
  initial,
  partialFrames,
  initialBootMs,
  ready: Promise.all(keys.map((key) => attachments.get(key)?.ready)).then(() => undefined),
  read,
  async refresh(key) {
    await attachments.get(key)?.refresh();
    return read(key);
  },
  cancel(key) {
    attachments.get(key)?.cancel();
    return read(key);
  },
  dispose(key) {
    attachments.get(key)?.dispose();
    return read(key);
  },
  async mount(key) {
    await mount(key).ready;
    return read(key);
  },
  damage(key) {
    const scope = scopes[key];
    const root = scope.getRootNode() as Document | ShadowRoot;
    const id = scope.getAttribute('data-lab-colors-scope');
    const selector = `[data-lab-colors-scope="${id}"]`;
    const rule = root.adoptedStyleSheets
      .flatMap((sheet) => [...sheet.cssRules])
      .find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule && rule.selectorText === selector,
      );
    if (!rule) throw new Error('Не найден собственный слой Colors');
    rule.style.removeProperty('--lab-fill-accent');
  },
  async probeLifecycle(action) {
    const scope = document.createElement('section');
    scope.setAttribute('data-theme', 'light');
    scope.setAttribute('data-contrast', 'normal');
    document.body.append(scope);
    const states: LabuiColorsState['state'][] = [];
    let stop = false;
    let attachment: LabuiColorsAttachment;
    const mount = () =>
      attachLabuiColors({
        scope,
        config: authored,
        observe() {
          if (stop) {
            stop = false;
            attachment[action]();
          }
          return { kind: 'observed', surface: [255, 255, 255] };
        },
        onState(state) {
          states.push(state.state);
        },
      });
    attachment = mount();
    try {
      await attachment.ready;
      states.length = 0;
      stop = true;
      const stopped = (await attachment.refresh()).state;
      const terminalStates = [...states];
      const masked = names.every((name) => !getComputedStyle(scope).getPropertyValue(name).trim());
      const hasScope = scope.hasAttribute('data-lab-colors-scope');
      if (action === 'dispose') attachment = mount();
      const restored =
        action === 'dispose' ? (await attachment.ready).state : (await attachment.refresh()).state;
      const populated = names.filter((name) =>
        getComputedStyle(scope).getPropertyValue(name).trim(),
      ).length;
      return { stopped, states: terminalStates, masked, hasScope, restored, populated };
    } finally {
      attachment.dispose();
      scope.remove();
    }
  },
  async probeFrameSampling() {
    const scope = document.createElement('section');
    scope.setAttribute('data-theme', 'light');
    scope.setAttribute('data-contrast', 'normal');
    document.body.append(scope);
    const samples: Array<[number, number, number]> = [];
    const commits: Array<{ tone: string; populated: number }> = [];
    const attachment = attachLabuiColors({
      scope,
      config: authored,
      observe: () => ({ kind: 'observed', surface: samples.shift() ?? [255, 255, 255] }),
      onState(state) {
        if (state.state !== 'ready') return;
        const style = getComputedStyle(scope);
        commits.push({
          tone: style.getPropertyValue('--lab-bg-tone-2').trim(),
          populated: names.filter((name) => style.getPropertyValue(name).trim()).length,
        });
      },
    });
    const frames = async (count: number) => {
      for (let index = 0; index < count; index++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    };
    try {
      await attachment.ready;
      const initial = getComputedStyle(scope).getPropertyValue('--lab-bg-tone-2').trim();
      commits.length = 0;
      samples.push([0, 0, 0], [255, 255, 255]);
      await frames(4);
      const changed = [...commits];
      await frames(4);
      return {
        initial,
        commits: changed,
        stableCommits: commits.length - changed.length,
        propertyCount: names.length,
      };
    } finally {
      attachment.dispose();
      scope.remove();
    }
  },
  async probePublisherReentry(origin, action) {
    const scope = document.createElement('section');
    scope.setAttribute('data-theme', 'light');
    scope.setAttribute('data-contrast', 'normal');
    document.body.append(scope);
    const events: LabuiColorsState['state'][] = [];
    const callbacks: LabuiColorsState['state'][] = [];
    let attachment: LabuiColorsAttachment;
    const interrupt = (boundary: typeof origin, state: LabuiColorsState['state']) => {
      if (boundary === origin && state === 'ready' && action !== 'none') attachment[action]();
    };
    scope.addEventListener('lab-colors-state', (event) => {
      const state = (event as CustomEvent<LabuiColorsState>).detail.state;
      events.push(state);
      interrupt('listener', state);
    });
    attachment = attachLabuiColors({
      scope,
      config: authored,
      observe: () => ({ kind: 'observed', surface: [255, 255, 255] }),
      onState(state) {
        callbacks.push(state.state);
        interrupt('callback', state.state);
      },
    });
    try {
      const ready = await attachment.ready;
      return {
        ready: ready.state,
        state: attachment.state.state,
        attribute: scope.getAttribute('data-lab-colors-state'),
        events: [...events],
        callbacks: [...callbacks],
      };
    } finally {
      attachment.dispose();
      scope.remove();
    }
  },
  async measureRoot(count) {
    if (!Number.isInteger(count) || count < 1 || count > 64)
      throw new Error('Неверный размер нагрузки');
    const elapsedMs = [];
    let before = read('root');
    for (let index = 0; index < count; index++) {
      const revision = before.revision;
      const committed = new Promise<number>((resolve, reject) => {
        const listener = (event: Event) => {
          const state = (event as CustomEvent<LabuiColorsState>).detail;
          if (state.state === 'ready' && String(state.revision) === revision) return;
          scopes.root.removeEventListener('lab-colors-state', listener);
          if (state.state === 'ready') resolve(performance.now());
          else reject(new Error(`Обновление завершилось состоянием ${state.state}`));
        };
        scopes.root.addEventListener('lab-colors-state', listener);
      });
      // Замер включает обнаружение DOM-изменения в кадре и подтверждение host.
      const startedAt = performance.now();
      backdrops.root.style.backgroundColor = index % 2 === 0 ? 'rgb(0 0 0)' : 'rgb(255 255 255)';
      elapsedMs.push((await committed) - startedAt);
      const after = read('root');
      if (
        after.populated !== after.propertyCount ||
        after.properties['--lab-bg-tone-2'] === before.properties['--lab-bg-tone-2'] ||
        after.properties['--lab-fill-brand-primary'] !==
          before.properties['--lab-fill-brand-primary'] ||
        after.properties['--lab-bg-tone-1'] !== before.properties['--lab-bg-tone-1']
      ) {
        throw new Error('Измеренный запрос не завершился корректным полным результатом');
      }
      before = after;
    }
    return { elapsedMs, propertyCount: before.propertyCount, outputCount: before.outputCount };
  },
};
