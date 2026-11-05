// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';

interface Runtime {
  ariaHidden(targets: HTMLElement[], options: { defer: boolean }): () => void;
}

const require = createRequire(import.meta.url);
const dialogRequire = createRequire(require.resolve('@zag-js/dialog'));
const directory = dirname(dialogRequire.resolve('@zag-js/aria-hidden'));
const cleanups = new Set<() => void>();

async function load(format: 'esm' | 'cjs'): Promise<Runtime> {
  return format === 'esm'
    ? import(pathToFileURL(join(directory, 'index.mjs')).href)
    : dialogRequire('@zag-js/aria-hidden');
}

function mount(owner = document): HTMLElement {
  const element = owner.createElement('div');
  owner.body.append(element);
  return element;
}

function hide(runtime: Runtime, element: HTMLElement): () => void {
  const cleanup = runtime.ariaHidden([element], { defer: false });
  cleanups.add(cleanup);
  return () => {
    cleanups.delete(cleanup);
    cleanup();
  };
}

afterEach(() => {
  for (const cleanup of [...cleanups].reverse()) cleanup();
  cleanups.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

for (const format of ['esm', 'cjs'] as const) {
  it(`${format}: single lock скрывает фон и сохраняет заданный потребителем aria-hidden`, async () => {
    const runtime = await load(format);
    const target = mount();
    const background = mount();
    const hiddenByConsumer = mount();
    hiddenByConsumer.setAttribute('aria-hidden', 'true');
    const close = hide(runtime, target);
    expect(target.hasAttribute('aria-hidden')).toBe(false);
    expect(background.getAttribute('aria-hidden')).toBe('true');
    close();
    expect(background.hasAttribute('aria-hidden')).toBe(false);
    expect(hiddenByConsumer.getAttribute('aria-hidden')).toBe('true');
  });

  it(`${format}: premounted nested portal видим, после закрытия восстанавливается parent`, async () => {
    const runtime = await load(format);
    const parent = mount();
    const child = mount();
    const background = mount();
    const closeParent = hide(runtime, parent);
    expect(child.getAttribute('aria-hidden')).toBe('true');
    const closeChild = hide(runtime, child);
    expect(child.hasAttribute('aria-hidden')).toBe(false);
    expect(parent.getAttribute('aria-hidden')).toBe('true');
    expect(background.getAttribute('aria-hidden')).toBe('true');
    closeChild();
    expect(parent.hasAttribute('aria-hidden')).toBe(false);
    expect(child.getAttribute('aria-hidden')).toBe('true');
    expect(background.getAttribute('aria-hidden')).toBe('true');
    closeParent();
    expect(child.hasAttribute('aria-hidden')).toBe(false);
    expect(background.hasAttribute('aria-hidden')).toBe(false);
  });

  it(`${format}: удаление нижнего lock сохраняет открытого survivor`, async () => {
    const runtime = await load(format);
    const parent = mount();
    const child = mount();
    const background = mount();
    const closeParent = hide(runtime, parent);
    const closeChild = hide(runtime, child);
    closeParent();
    parent.remove();
    expect(child.hasAttribute('aria-hidden')).toBe(false);
    expect(background.getAttribute('aria-hidden')).toBe('true');
    closeChild();
    expect(background.hasAttribute('aria-hidden')).toBe(false);
  });

  it(`${format}: detached target не снимает действующую модальность`, async () => {
    const runtime = await load(format);
    const target = mount();
    const background = mount();
    hide(runtime, target);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    hide(runtime, document.createElement('div'));
    expect(error).toHaveBeenCalledTimes(1);
    expect(target.hasAttribute('aria-hidden')).toBe(false);
    expect(background.getAttribute('aria-hidden')).toBe('true');
  });

  it(`${format}: modal другого document не приостанавливает текущий lock`, async () => {
    const runtime = await load(format);
    const target = mount();
    const background = mount();
    const anotherDocument = document.implementation.createHTMLDocument('Независимое окно');
    const anotherTarget = mount(anotherDocument);
    const anotherBackground = mount(anotherDocument);
    const close = hide(runtime, target);
    const closeAnother = hide(runtime, anotherTarget);
    expect(target.hasAttribute('aria-hidden')).toBe(false);
    expect(background.getAttribute('aria-hidden')).toBe('true');
    expect(anotherTarget.hasAttribute('aria-hidden')).toBe(false);
    expect(anotherBackground.getAttribute('aria-hidden')).toBe('true');
    closeAnother();
    expect(background.getAttribute('aria-hidden')).toBe('true');
    close();
    expect(background.hasAttribute('aria-hidden')).toBe(false);
  });

  it(`${format}: controlled popup появляется и исчезает из accessibility tree`, async () => {
    const runtime = await load(format);
    const target = mount();
    target.innerHTML = '<button aria-controls="popup" aria-expanded="false">Настройки</button>';
    const controller = target.querySelector('button');
    if (!controller) throw new Error('Не создан controller');
    const popup = mount();
    popup.id = 'popup';
    popup.setAttribute('role', 'menu');
    popup.innerHTML = '<button role="menuitem">Действие</button>';
    const item = popup.firstElementChild;
    if (!item) throw new Error('Не создано действие popup');
    hide(runtime, target);
    expect(popup.getAttribute('aria-hidden')).toBe('true');
    controller.setAttribute('aria-expanded', 'true');
    await vi.waitFor(() => expect(popup.hasAttribute('aria-hidden')).toBe(false));
    expect(item.hasAttribute('aria-hidden')).toBe(false);
    controller.setAttribute('aria-expanded', 'false');
    await vi.waitFor(() => expect(popup.getAttribute('aria-hidden')).toBe('true'));
  });

  it(`${format}: controller из скрытого фона не раскрывает свой popup`, async () => {
    const runtime = await load(format);
    const target = mount();
    const background = mount();
    background.innerHTML =
      '<button aria-controls="popup" aria-expanded="false">Фоновое действие</button>';
    const controller = background.querySelector('button');
    if (!controller) throw new Error('Не создан фоновый controller');
    const popup = mount();
    popup.id = 'popup';
    popup.setAttribute('role', 'menu');
    hide(runtime, target);
    controller.setAttribute('aria-expanded', 'true');
    // Следующий callback того же MutationObserver уже был доставлен.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(background.getAttribute('aria-hidden')).toBe('true');
    expect(popup.getAttribute('aria-hidden')).toBe('true');
  });
}
