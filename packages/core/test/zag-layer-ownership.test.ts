// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';

interface Layer {
  node: HTMLElement;
  parent?: HTMLElement;
}
interface Stack {
  layers: Layer[];
  recentlyRemoved: Set<HTMLElement>;
  add(layer: Layer): void;
  remove(node: HTMLElement): void;
  getNestedLayers(node: HTMLElement): Layer[];
  isTopMost(node: HTMLElement): boolean;
}
interface Options {
  defer?: boolean;
  exclude?: HTMLElement[];
  persistentElements?: (() => HTMLElement)[];
  onDismiss?(): void;
  onRequestDismiss?(event: CustomEvent<{ targetLayer?: HTMLElement }>): void;
}
interface Runtime {
  stack: Stack;
  trackDismissableElement(node: HTMLElement, options: Options): () => void;
}

const require = createRequire(import.meta.url);
const dialogRequire = createRequire(require.resolve('@zag-js/dialog'));
const directory = dirname(dialogRequire.resolve('@zag-js/dismissable'));
let stack: Stack | undefined;
let cleanups: (() => void)[] = [];

async function load(format: 'esm' | 'cjs'): Promise<Runtime> {
  const module = async (name: string) => {
    const file = join(directory, `${name}.${format === 'esm' ? 'mjs' : 'js'}`);
    return format === 'esm' ? import(pathToFileURL(file).href) : dialogRequire(file);
  };
  const layers = await module('layer-stack');
  const dismissable = await module('dismissable-layer');
  stack = layers.layerStack;
  return { stack: layers.layerStack, trackDismissableElement: dismissable.trackDismissableElement };
}

function mount(tag = 'div'): HTMLElement {
  const node = document.createElement(tag);
  document.body.append(node);
  return node;
}

function track(runtime: Runtime, node: HTMLElement, options: Options = {}): () => void {
  const cleanup = runtime.trackDismissableElement(node, { onDismiss() {}, ...options });
  cleanups.push(cleanup);
  return cleanup;
}

afterEach(() => {
  for (const cleanup of cleanups.reverse()) cleanup();
  cleanups = [];
  while (stack?.layers.length) stack.remove(stack.layers[0].node);
  stack?.recentlyRemoved.clear();
  stack = undefined;
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.replaceChildren();
});

for (const format of ['esm', 'cjs'] as const) {
  it(`${format}: поздний outside старого слоя сохраняет новый sibling`, async () => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'],
    });
    const runtime = await load(format);
    const old = mount();
    const oldTrigger = mount('button');
    const next = mount();
    const nextTrigger = mount('button');
    const onOldDismiss = vi.fn(() => oldCleanup());
    const onNextDismiss = vi.fn();
    const oldCleanup = track(runtime, old, {
      defer: true,
      exclude: [oldTrigger],
      onDismiss: onOldDismiss,
    });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(17);

    // Outside уже поставлен на RAF; новый слой зарегистрируется до его выполнения.
    nextTrigger.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: 1, clientY: 1 }),
    );
    track(runtime, next, { defer: true, exclude: [nextTrigger], onDismiss: onNextDismiss });
    await Promise.resolve();
    expect(runtime.stack.isTopMost(next)).toBe(true);
    await vi.advanceTimersByTimeAsync(17);

    expect(onOldDismiss).toHaveBeenCalledTimes(1);
    expect(onNextDismiss).not.toHaveBeenCalled();
    expect(runtime.stack.isTopMost(next)).toBe(true);
  });

  it(`${format}: parent закрывает весь настоящий portal subtree`, async () => {
    const runtime = await load(format);
    const parent = mount();
    const child = mount();
    const leaf = mount();
    const childTrigger = document.createElement('button');
    const leafTrigger = document.createElement('button');
    parent.append(childTrigger);
    child.append(leafTrigger);
    const parentCleanup = track(runtime, parent);
    const childDismiss = vi.fn(() => childCleanup());
    const leafDismiss = vi.fn(() => leafCleanup());
    const childCleanup = track(runtime, child, {
      exclude: [childTrigger],
      onDismiss: childDismiss,
    });
    const leafCleanup = track(runtime, leaf, { exclude: [leafTrigger], onDismiss: leafDismiss });
    expect(runtime.stack.getNestedLayers(parent).map((layer) => layer.node)).toEqual([child, leaf]);

    parentCleanup();
    expect(childDismiss).toHaveBeenCalledTimes(1);
    expect(leafDismiss).toHaveBeenCalledTimes(1);
    expect(runtime.stack.layers).toEqual([]);
  });

  it(`${format}: persistent element не назначает владельца sibling`, async () => {
    const runtime = await load(format);
    const parent = mount();
    const persistent = document.createElement('button');
    parent.append(persistent);
    const sibling = mount();
    const siblingTrigger = mount('button');
    const inline = document.createElement('div');
    parent.append(inline);
    const siblingDismiss = vi.fn();
    const inlineDismiss = vi.fn();
    const parentCleanup = track(runtime, parent);
    track(runtime, sibling, {
      exclude: [siblingTrigger],
      persistentElements: [() => persistent],
      onDismiss: siblingDismiss,
    });
    track(runtime, inline, { onDismiss: inlineDismiss });
    expect(runtime.stack.getNestedLayers(parent).map((layer) => layer.node)).toEqual([inline]);
    expect(sibling.hasAttribute('data-nested')).toBe(false);
    expect(parent.style.getPropertyValue('--nested-layer-count')).toBe('1');

    parentCleanup();
    expect(siblingDismiss).not.toHaveBeenCalled();
    expect(inlineDismiss).toHaveBeenCalledTimes(1);
  });

  it(`${format}: re-registration parent выше child сохраняет ancestry и cleanup`, async () => {
    const runtime = await load(format);
    const parent = mount();
    const child = mount();
    const childTrigger = document.createElement('button');
    parent.append(childTrigger);
    const parentCleanup = track(runtime, parent);
    const childDismiss = vi.fn(() => childCleanup());
    const childCleanup = track(runtime, child, {
      exclude: [childTrigger],
      onDismiss: childDismiss,
    });
    const parentLayer = runtime.stack.layers.find((layer) => layer.node === parent);
    if (!parentLayer) throw new Error('Не зарегистрирован parent');
    runtime.stack.add(parentLayer);
    expect(runtime.stack.layers.map((layer) => layer.node)).toEqual([child, parent]);
    expect(runtime.stack.getNestedLayers(parent).map((layer) => layer.node)).toEqual([child]);

    parentCleanup();
    expect(childDismiss).toHaveBeenCalledTimes(1);
    expect(runtime.stack.layers).toEqual([]);
  });

  it(`${format}: surviving child переходит к живому ancestor после veto`, async () => {
    const runtime = await load(format);
    const parent = mount();
    const middle = mount();
    const leaf = mount();
    const middleTrigger = document.createElement('button');
    const leafTrigger = document.createElement('button');
    parent.append(middleTrigger);
    middle.append(leafTrigger);
    const parentCleanup = track(runtime, parent);
    const middleCleanup = track(runtime, middle, { exclude: [middleTrigger] });
    const leafDismiss = vi.fn(() => leafCleanup());
    const leafCleanup = track(runtime, leaf, {
      exclude: [leafTrigger],
      onDismiss: leafDismiss,
      onRequestDismiss(event) {
        if (event.detail.targetLayer === middle) event.preventDefault();
      },
    });

    middleCleanup();
    expect(leafDismiss).not.toHaveBeenCalled();
    expect(runtime.stack.layers.find((layer) => layer.node === leaf)?.parent).toBe(parent);
    parentCleanup();
    expect(leafDismiss).toHaveBeenCalledTimes(1);
    expect(runtime.stack.layers).toEqual([]);
  });

  it(`${format}: отсутствие trigger сохраняет реальное DOM ownership`, async () => {
    const runtime = await load(format);
    const parent = mount();
    const sibling = mount();
    const siblingDismiss = vi.fn();
    const parentCleanup = track(runtime, parent);
    track(runtime, sibling, { onDismiss: siblingDismiss });
    expect(runtime.stack.getNestedLayers(parent)).toEqual([]);
    parentCleanup();
    expect(siblingDismiss).not.toHaveBeenCalled();
    expect(runtime.stack.isTopMost(sibling)).toBe(true);
  });
}
