// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';

interface Query {
  isFocusable(node: HTMLElement): boolean;
  isTabbable(node: HTMLElement): boolean;
  getTabbables(node: HTMLElement, options?: { getShadowRoot: boolean }): HTMLElement[];
  getFocusables(node: HTMLElement, options?: { getShadowRoot: boolean }): HTMLElement[];
  contains(parent: HTMLElement, child: HTMLElement): boolean;
}
interface Dismissable {
  trackDismissableElement(
    node: HTMLElement,
    options: { defer: boolean; onDismiss(): void },
  ): () => void;
}

const require = createRequire(import.meta.url);
const dialogRequire = createRequire(require.resolve('@zag-js/dialog'));
async function load<T>(name: string, format: 'esm' | 'cjs'): Promise<T> {
  if (format === 'cjs') return dialogRequire(name) as T;
  const entry = join(dirname(dialogRequire.resolve(name)), 'index.mjs');
  return (await import(pathToFileURL(entry).href)) as T;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

for (const format of ['esm', 'cjs'] as const) {
  it.each(['disabled', 'inert', 'visibility-hidden', 'visibility-collapse'])(
    `${format}: positive tabindex не обходит %s eligibility`,
    async (state) => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(16);
      const query = await load<Query>('@zag-js/dom-query', format);
      const button = document.createElement('button');
      button.tabIndex = 2;
      document.body.append(button);
      expect(query.isFocusable(button)).toBe(true);
      expect(query.isTabbable(button)).toBe(true);
      if (state === 'disabled') button.disabled = true;
      else if (state === 'inert') button.inert = true;
      else button.style.visibility = state === 'visibility-hidden' ? 'hidden' : 'collapse';
      expect(query.isFocusable(button)).toBe(false);
      expect(query.isTabbable(button)).toBe(false);
      expect(query.getFocusables(document.body)).not.toContain(button);
      expect(query.getTabbables(document.body)).not.toContain(button);
    },
  );

  it.each(['shadow', 'slot'])(
    `${format}: %s inert ancestor исключает цель из focus и Tab`,
    async (ancestry) => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(16);
      const query = await load<Query>('@zag-js/dom-query', format);
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      const button = document.createElement('button');
      button.tabIndex = 1;
      document.body.append(host);
      if (ancestry === 'shadow') shadow.append(button);
      else {
        const blocker = document.createElement('div');
        const slot = document.createElement('slot');
        blocker.append(slot);
        shadow.append(blocker);
        host.append(button);
        expect(slot.assignedElements()).toContain(button);
        Object.defineProperty(button, 'assignedSlot', { configurable: true, get: () => slot });
      }
      expect(query.isFocusable(button)).toBe(true);
      if (ancestry === 'shadow') host.inert = true;
      else shadow.querySelector('div')?.setAttribute('inert', '');
      expect(query.isFocusable(button)).toBe(false);
      expect(query.isTabbable(button)).toBe(false);
    },
  );

  it(`${format}: обычные DOM-потомки, forwarded slot и нефокусируемый shadow host образуют один focus scope`, async () => {
    // Здесь проверяется топология. Видимость и реальный Tab проверяются браузерами.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(16);
    const query = await load<Query>('@zag-js/dom-query', format);
    const host = document.createElement('div');
    host.innerHTML =
      '<div slot="content"><input id="assigned" /><div id="shadow-host"></div><div id="negative" tabindex="-1"></div><div inert><input id="inert" /></div><input id="disabled" disabled /></div>';
    document.body.append(host);
    const shadowHost = host.querySelector('#shadow-host');
    const negativeHost = host.querySelector('#negative');
    if (!shadowHost || !negativeHost) throw new Error('Не созданы shadow hosts');
    shadowHost.attachShadow({ mode: 'open' }).innerHTML =
      '<input id="shadow-field" /><slot name="nested"></slot>';
    shadowHost.innerHTML = '<button id="forwarded" slot="nested">Действие</button>';
    negativeHost.attachShadow({ mode: 'open' }).innerHTML = '<input id="negative-field" />';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<div id="plane"><slot name="content" slot="content"></slot></div>';
    const plane = root.querySelector('#plane');
    if (!plane) throw new Error('Не создана плоскость');
    const portal = plane.attachShadow({ mode: 'open' });
    portal.innerHTML =
      '<div id="content" tabindex="-1"><button id="before">До</button><slot name="content"></slot><button id="after">После</button></div>';
    const content = portal.querySelector<HTMLElement>('#content');
    const assigned = host.querySelector<HTMLElement>('#assigned');
    if (!content || !assigned) throw new Error('Не создан focus scope');
    const body = assigned.parentElement;
    const forwardingSlot = root.querySelector<HTMLSlotElement>('slot');
    const portalSlot = portal.querySelector<HTMLSlotElement>('slot');
    if (!body || !forwardingSlot || !portalSlot) throw new Error('Не создано назначение слотов');
    expect(forwardingSlot.assignedElements()).toContain(body);
    expect(portalSlot.assignedElements()).toContain(forwardingSlot);
    // HappyDOM 21.0.4 сохраняет assignedElements, но теряет assignedSlot.
    // Эти две связи квалифицированы в Chromium 156 и WebKit 27.2 через
    // composition-remediation-research/assigned-slot-fidelity.{cjs,json}.
    // Моделируем только связи этого unit-графа, без подмены query.contains.
    Object.defineProperty(body, 'assignedSlot', { configurable: true, get: () => forwardingSlot });
    Object.defineProperty(forwardingSlot, 'assignedSlot', {
      configurable: true,
      get: () => portalSlot,
    });
    expect(query.getTabbables(content, { getShadowRoot: true }).map((node) => node.id)).toEqual([
      'before',
      'assigned',
      'shadow-field',
      'forwarded',
      'after',
    ]);
    expect(query.getFocusables(content, { getShadowRoot: true }).map((node) => node.id)).toEqual([
      'before',
      'assigned',
      'shadow-field',
      'forwarded',
      'negative',
      'negative-field',
      'after',
    ]);
    expect(query.getTabbables(content).map((node) => node.id)).toEqual(['before', 'after']);
    expect(query.contains(content, assigned)).toBe(true);
    expect(query.contains(content, document.body)).toBe(false);
  });

  it(`${format}: Escape после commit принадлежит последнему слою, cleanup и отмена до commit отзывают listener`, async () => {
    const dismissable = await load<Dismissable>('@zag-js/dismissable', format);
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);
    const dismissed: string[] = [];
    const disposeFirst = dismissable.trackDismissableElement(first, {
      defer: true,
      onDismiss: () => dismissed.push('first'),
    });
    const disposeSecond = dismissable.trackDismissableElement(second, {
      defer: true,
      onDismiss: () => dismissed.push('second'),
    });
    try {
      await Promise.resolve();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      expect(dismissed).toEqual(['second']);
    } finally {
      disposeSecond();
      disposeFirst();
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(dismissed).toEqual(['second']);

    const disposeCancelled = dismissable.trackDismissableElement(first, {
      defer: true,
      onDismiss: () => dismissed.push('cancelled'),
    });
    disposeCancelled();
    await Promise.resolve();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(dismissed).toEqual(['second']);
  });
}
