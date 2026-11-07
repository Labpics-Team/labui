import { mountMaterialRuntime } from '@labpics/ui-materials';

export type RuntimeScope = 'document' | 'container' | 'surface';
export type MaterialMode = 'solid' | 'glass' | 'acrylic';

const surface = document.querySelector<HTMLElement>('#surface');
const container = document.querySelector<HTMLElement>('#container');
if (!surface || !container) throw new Error('Отсутствует поверхность теста');

const hosts = { document, container, surface };
const releases: (() => void)[] = [];
const identities = new WeakMap<Node, number>();
let nextIdentity = 0;

function identity(node: Node): number {
  let id = identities.get(node);
  if (id === undefined) {
    id = ++nextIdentity;
    identities.set(node, id);
  }
  return id;
}

const hooks = {
  mount(scope: RuntimeScope): number {
    return releases.push(mountMaterialRuntime(hosts[scope])) - 1;
  },
  dispose(id: number): void {
    releases[id]?.();
  },
  mode(mode: MaterialMode): void {
    surface.setAttribute('data-material', mode);
  },
  connect(connected: boolean): void {
    if (connected) container.appendChild(surface);
    else surface.remove();
  },
  snapshot() {
    return {
      filters: [...document.querySelectorAll('filter[id^="lab-acrylic-"], filter[id^="lab-lg-"]')]
        .map((filter) => filter.id)
        .sort(),
      strips: [...surface.querySelectorAll(':scope > .lab-veil__strip')].map(identity),
      backdrop: surface.style.getPropertyValue('backdrop-filter'),
      priority: surface.style.getPropertyPriority('backdrop-filter'),
      webkitBackdrop: surface.style.getPropertyValue('-webkit-backdrop-filter'),
      webkitPriority: surface.style.getPropertyPriority('-webkit-backdrop-filter'),
      lensed: surface.classList.contains('lab-material--lensed'),
    };
  },
  async settle(): Promise<void> {
    // Даём MutationObserver, ResizeObserver и их trailing-rAF завершить текущий переход.
    for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
  },
};

declare global {
  interface Window {
    __materialLifetime: typeof hooks;
  }
}

window.__materialLifetime = hooks;
