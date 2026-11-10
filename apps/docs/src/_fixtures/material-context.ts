import { mountMaterialRuntime } from '@labpics/ui-materials';
import { materialCss } from '@labpics/ui-materials/css';

export type ContextScope = 'light' | 'open' | 'closed';
const params = new URLSearchParams(location.search);
const scope = (params.get('scope') ?? 'light') as ContextScope;
const mode = params.get('mode') === 'glass' ? 'glass' : 'acrylic';
const stages = [...document.querySelectorAll<HTMLElement>('.stage')];
const documentStyles = document.createElement('style');
documentStyles.textContent = materialCss;
document.head.appendChild(documentStyles);

function container(stage: HTMLElement, scope: ContextScope): HTMLElement | ShadowRoot {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0';
  stage.appendChild(host);
  if (scope === 'light') return host;
  const root = host.attachShadow({ mode: scope });
  const styles = document.createElement('style');
  styles.textContent = materialCss;
  root.appendChild(styles);
  return root;
}

const surfaces = stages.map((stage, index) => {
  const surface = document.createElement('section');
  surface.className = 'lab-material';
  surface.dataset.material = mode;
  // CSS владельца задаёт режим. Декоративный paint и исходный backdrop выключены,
  // чтобы PNG различал именно SVG-эффект и его локальные цветовые токены.
  surface.style.cssText = `position:absolute;left:40px;top:40px;width:240px;height:160px;border-radius:16px;background:none;backdrop-filter:none;--lab-bg-material-base-01:rgb(${index ? '30 30 30' : '235 235 235'});--_lg-refraction:1;--_lg-depth:40;--_lg-dispersion:0.4`;
  container(stage, scope).appendChild(surface);
  return surface;
});
const releases: (() => void)[] = [];

const hooks = {
  mount(): void {
    for (const surface of surfaces) releases.push(mountMaterialRuntime(surface));
  },
  dispose(index: number): void {
    releases[index]?.();
  },
  token(index: number, value: string): void {
    surfaces[index]?.style.setProperty('--lab-bg-material-base-01', value);
  },
  ancestorToken(value: string): void {
    document.body.style.setProperty('--lab-bg-material-base-01', value);
  },
  move(index: number, scope: ContextScope): void {
    const stage = stages[index];
    const surface = surfaces[index];
    if (!stage || !surface) throw new Error('Нет поверхности');
    container(stage, scope).appendChild(surface);
  },
  replaceContent(index: number, operation: 'textContent' | 'replaceChildren'): void {
    const surface = surfaces[index];
    if (!surface) throw new Error('Нет поверхности');
    if (operation === 'textContent') surface.textContent = '';
    else surface.replaceChildren(document.createElement('span'));
  },
  snapshot(index: number) {
    const surface = surfaces[index];
    if (!surface) throw new Error('Нет поверхности');
    const { x, y, width, height } = surface.getBoundingClientRect();
    return {
      rect: { x, y, width, height },
      backdrop: getComputedStyle(surface).backdropFilter,
      inline: surface.getAttribute('style'),
      ownedSvg: surface.querySelectorAll('svg').length,
      connected: surface.isConnected,
    };
  },
  async settle(): Promise<void> {
    for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
  },
};

declare global {
  interface Window {
    __materialContext: typeof hooks;
  }
}
window.__materialContext = hooks;
