// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it } from 'vitest';

interface ControllerQuery {
  isControlledElement(container: HTMLElement, element: HTMLElement): boolean;
  findControlledElements(container: HTMLElement, callback: (element: HTMLElement) => void): void;
  getControlledElements(container: HTMLElement): HTMLElement[];
  hasControllerElements(container: HTMLElement): boolean;
  isControlledByExpandedController(element: HTMLElement): boolean;
}

const require = createRequire(import.meta.url);
const scopeRequire = createRequire(require.resolve('@zag-js/dialog'));
async function load(format: 'esm' | 'cjs'): Promise<ControllerQuery> {
  // Для контрольного RED разрешён exact старый dist с теми же DOM-инвариантами.
  const directory =
    process.env.LABUI_CONTROLLER_BASELINE_DIST ??
    dirname(scopeRequire.resolve('@zag-js/dom-query'));
  const file = join(directory, format === 'esm' ? 'controller.mjs' : 'controller.js');
  return format === 'esm' ? import(pathToFileURL(file).href) : scopeRequire(file);
}

afterEach(() => document.body.replaceChildren());

for (const format of ['esm', 'cjs'] as const) {
  it(`${format}: forwarded controller сохраняет внешний popup и root его IDs`, async () => {
    const query = await load(format);
    const host = document.createElement('div');
    host.innerHTML =
      '<div slot="content"><button aria-controls="popup" aria-expanded="true">Открыть</button></div>';
    const outer = host.attachShadow({ mode: 'open' });
    outer.innerHTML = '<div id="plane"><slot name="content" slot="content"></slot></div>';
    const plane = outer.querySelector('#plane');
    if (!plane) throw new Error('Не создана плоскость');
    const inner = plane.attachShadow({ mode: 'open' });
    inner.innerHTML = '<div id="content"><slot name="content"></slot></div>';
    const content = inner.querySelector<HTMLElement>('#content');
    const popup = document.createElement('div');
    popup.id = 'popup';
    popup.setAttribute('role', 'dialog');
    popup.innerHTML = '<input />';
    document.body.append(host, popup);
    const field = popup.querySelector('input');
    if (!content || !field) throw new Error('Не созданы контролируемые элементы');
    expect(query.hasControllerElements(content)).toBe(true);
    expect(query.isControlledElement(content, field)).toBe(true);
    expect(query.getControlledElements(content)).toEqual([popup]);
    expect(query.isControlledByExpandedController(popup)).toBe(true);
    host.querySelector('button')?.setAttribute('aria-expanded', 'false');
    expect(query.hasControllerElements(content)).toBe(false);
    expect(query.isControlledElement(content, field)).toBe(false);
    expect(query.getControlledElements(content)).toEqual([]);
  });

  it(`${format}: обычные controllers действуют, закрытые и modal targets не расширяют scope`, async () => {
    const query = await load(format);
    document.body.innerHTML =
      '<div id="content"><button aria-controls="popup" aria-expanded="true">Открыть</button></div><div id="popup" role="dialog"><input /></div>';
    const content = document.getElementById('content');
    const popup = document.getElementById('popup');
    const field = popup?.querySelector('input');
    if (!content || !popup || !field) throw new Error('Не создан обычный scope');
    expect(query.isControlledElement(content, field)).toBe(true);
    expect(query.getControlledElements(content)).toEqual([popup]);
    popup.setAttribute('aria-modal', 'true');
    expect(query.isControlledElement(content, field)).toBe(false);
    expect(query.getControlledElements(content)).toEqual([]);
    popup.removeAttribute('aria-modal');
    content.querySelector('button')?.setAttribute('aria-expanded', 'false');
    expect(query.hasControllerElements(content)).toBe(false);
    expect(query.isControlledByExpandedController(popup)).toBe(false);
  });

  it(`${format}: recursive popup cycle посещает каждый target один раз`, async () => {
    const query = await load(format);
    document.body.innerHTML =
      '<div id="content"><button aria-controls="a" aria-expanded="true">Открыть</button></div><div id="a" role="dialog"><button aria-controls="b" aria-expanded="true">Далее</button></div><div id="b" role="menu"><button aria-controls="a" aria-expanded="true">Назад</button><input /></div>';
    const content = document.getElementById('content');
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    const field = b?.querySelector('input');
    if (!content || !a || !b || !field) throw new Error('Не создан recursive scope');
    expect(query.getControlledElements(content)).toEqual([a, b]);
    expect(query.isControlledElement(content, field)).toBe(true);
  });

  it(`${format}: одинаковые IDs в разных shadow roots сохраняют двух владельцев`, async () => {
    const query = await load(format);
    const container = document.createElement('div');
    const targets: HTMLElement[] = [];
    for (let index = 0; index < 2; index++) {
      const host = document.createElement('div');
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<button aria-controls="same" aria-expanded="true">Открыть</button><div id="same" role="dialog"><input /></div>';
      const target = root.getElementById('same');
      if (!target) throw new Error('Не создан shadow target');
      targets.push(target);
      container.append(host);
    }
    const decoy = document.createElement('div');
    decoy.id = 'same';
    decoy.setAttribute('role', 'dialog');
    document.body.append(decoy, container);
    const discovered: HTMLElement[] = [];
    query.findControlledElements(container, (target) => discovered.push(target));
    expect(discovered).toEqual(targets);
    expect(targets.map((target) => query.isControlledByExpandedController(target))).toEqual([
      true,
      true,
    ]);
    expect(query.isControlledByExpandedController(decoy)).toBe(false);
  });

  it(`${format}: detached tree разрешает только собственные IDs без document fallback`, async () => {
    const query = await load(format);
    document.body.innerHTML = '<div id="outside" role="dialog"><input /></div>';
    const container = document.createElement('div');
    container.innerHTML =
      '<div id="content"><button aria-controls="local outside" aria-expanded="true">Открыть</button></div><div id="local" role="dialog"><input /></div>';
    const content = container.querySelector<HTMLElement>('#content');
    const local = container.querySelector<HTMLElement>('#local');
    const field = local?.querySelector('input');
    const outside = document.getElementById('outside');
    const outsideField = outside?.querySelector('input');
    if (!content || !local || !field || !outsideField) throw new Error('Не создан detached scope');
    expect(query.getControlledElements(content)).toEqual([local]);
    expect(query.isControlledElement(content, field)).toBe(true);
    expect(query.isControlledByExpandedController(local)).toBe(true);
    expect(query.isControlledElement(content, outsideField)).toBe(false);
  });
}
