import type { LabCard } from '@labpics/ui-core/card';

const closedRoots = new Map<string, ShadowRoot>();

// Потребитель владеет своей closed DSD; тест не подменяет attachShadow библиотеки.
class ShadowConsumer extends HTMLElement {
  constructor() {
    super();
    const root = this.attachInternals().shadowRoot;
    if (!root) throw new Error('Нет parser-created DSD');
    closedRoots.set(this.id, root);
  }
}
customElements.define('lab-shadow-consumer', ShadowConsumer);

function card(id: string): LabCard {
  const element =
    document.getElementById(id) ?? closedRoots.get('closed-owner')?.getElementById(id);
  if (!element) throw new Error(`Нет Card ${id}`);
  return element as LabCard;
}

function content(id: string): HTMLElement {
  const element = card(id).shadowRoot?.querySelector<HTMLElement>('[part="content"]');
  if (!element) throw new Error(`Нет Content ${id}`);
  return element;
}

const ids = [
  'standalone',
  'outer-glass',
  'closed-card',
  'explicit-solid',
  'unknown',
  'empty',
  'open-slot',
  'hidden-slot',
];
const disconnected = new Map<string, { element: LabCard; parent: Node; next: ChildNode | null }>();
const hooks = {
  ids,
  async hydrate(): Promise<void> {
    await import('@lit-labs/ssr-client/lit-element-hydrate-support.js');
    await import('@labpics/ui-core/card');
    await Promise.all(ids.map((id) => card(id).updateComplete));
    await hooks.settle();
  },
  snapshot(id: string) {
    const surface = content(id);
    const cs = getComputedStyle(surface);
    const { x, y, width, height } = surface.getBoundingClientRect();
    return {
      mode: cs.getPropertyValue('--_material-mode').trim() || 'solid',
      background: cs.backgroundColor,
      base: cs.getPropertyValue('--_base').trim(),
      basePaint: cs.getPropertyValue('--_base-paint').trim(),
      blur: cs.getPropertyValue('--_blur').trim(),
      backdrop: cs.backdropFilter,
      inlineBackdrop: surface.style.getPropertyValue('backdrop-filter'),
      filters: surface.querySelectorAll('filter').length,
      sheets:
        surface.getRootNode() instanceof ShadowRoot ? card(id).shadowRoot?.styleSheets.length : 0,
      rect: { x, y, width, height },
    };
  },
  outerMode(value: string): void {
    document.getElementById('outer-scope')?.setAttribute('data-material', value);
  },
  override(id: string, value: string | null): void {
    if (value === null) card(id).removeAttribute('data-material');
    else card(id).setAttribute('data-material', value);
  },
  slotMode(value: string): void {
    document
      .getElementById('open-owner')
      ?.shadowRoot?.getElementById('slot-scope')
      ?.setAttribute('data-material', value);
  },
  connect(id: string, connected: boolean): void {
    if (connected) {
      const saved = disconnected.get(id);
      if (saved) saved.parent.insertBefore(saved.element, saved.next);
    } else {
      const element = card(id);
      if (!element.parentNode) throw new Error('Нет родителя');
      disconnected.set(id, { element, parent: element.parentNode, next: element.nextSibling });
      element.remove();
    }
  },
  async settle(): Promise<void> {
    for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
  },
};

declare global {
  interface Window {
    __cardMaterial: typeof hooks;
  }
}
window.__cardMaterial = hooks;
