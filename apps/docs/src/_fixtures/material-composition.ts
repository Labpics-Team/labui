import { mountMaterialRuntime } from '@labpics/ui-materials';
import { materialCss } from '@labpics/ui-materials/css';
import colorCss from '@labui/colors/contract.css?inline';

type Scope = 'light' | 'shadow' | 'slot';

function section(testId: string): HTMLElement {
  const element = document.createElement('section');
  element.dataset.testid = testId;
  return element;
}

function surface(scope: Scope, name: string): HTMLElement {
  const element = section(`${scope}-${name}`);
  element.className = 'lab-material lab-material--base';
  element.style.cssText = 'box-sizing:border-box;width:18rem;min-height:3rem;padding:1rem';
  element.textContent = `${scope}: ${name}`;
  return element;
}

export function installMaterialComposition(runtime: boolean): void {
  const stage = document.querySelector('.stage');
  if (!stage) throw new Error('Нет контейнера материала');
  document.documentElement.removeAttribute('data-material');
  document.documentElement.removeAttribute('data-contrast');

  const outer = section('composition-outer');
  outer.dataset.material = 'glass';
  outer.dataset.contrast = 'more';
  outer.style.cssText = 'display:flex;flex-wrap:wrap;gap:1rem';
  stage.replaceChildren(outer);
  const releases: (() => void)[] = [];

  for (const scope of ['light', 'shadow', 'slot'] as const) {
    const host = section(`${scope}-host`);
    outer.appendChild(host);
    const container = scope === 'light' ? host : host.attachShadow({ mode: 'open' });
    if (container instanceof ShadowRoot) {
      const styles = document.createElement('style');
      // Владелец shadow root подключает настоящие публичные стили пакетов.
      // Fixture задаёт только размещение, не вычисляет цвет и материал.
      styles.textContent = `${colorCss}\n${materialCss}`;
      container.appendChild(styles);
    }

    const material = section(`${scope}-material`);
    material.dataset.compositionMaterial = '';
    material.dataset.material = 'acrylic';
    material.style.cssText = 'display:grid;gap:1rem';
    container.appendChild(material);
    const contrast = section(`${scope}-contrast`);
    contrast.dataset.compositionContrast = '';
    contrast.dataset.contrast = 'normal';
    contrast.style.cssText = 'display:grid;gap:1rem';
    const restored = section(`${scope}-restored-content`);
    restored.style.cssText = 'display:grid;gap:1rem';
    const solid = section(`${scope}-solid-scope`);
    solid.dataset.material = 'solid';
    restored.append(surface(scope, 'restored'), solid);
    solid.appendChild(surface(scope, 'solid'));

    if (scope === 'slot') {
      const inheritedSlot = document.createElement('slot');
      inheritedSlot.name = 'inherited';
      const restoredSlot = document.createElement('slot');
      restoredSlot.name = 'restored';
      material.append(inheritedSlot, contrast);
      contrast.appendChild(restoredSlot);
      const inherited = surface(scope, 'inherited');
      inherited.slot = 'inherited';
      restored.slot = 'restored';
      host.append(inherited, restored);
    } else {
      material.append(surface(scope, 'inherited'), contrast);
      contrast.appendChild(restored);
    }

    if (runtime) releases.push(mountMaterialRuntime(scope === 'slot' ? host : material));
  }

  const dispose = (): void => {
    for (const release of releases.splice(0)) release();
  };
  window.__materialComposition = { dispose };
  window.addEventListener('pagehide', dispose, { once: true });
}

declare global {
  interface Window {
    __materialComposition: { dispose(): void };
  }
}
