import { mountMaterialRuntime } from '@labpics/ui-materials';
import { materialCss } from '@labpics/ui-materials/css';

const style = document.createElement('style');
style.textContent = materialCss;
document.head.appendChild(style);
const scope = document.querySelector<HTMLElement>('.scope');
const veil = document.querySelector<HTMLElement>('.veil');
if (!scope || !veil) throw new Error('Нет поверхности для проверки длин');
const release = mountMaterialRuntime(scope);

function snapshot() {
  if (!veil) throw new Error('Поверхность удалена');
  const strips = [...veil.querySelectorAll<HTMLElement>('.lab-veil__strip')];
  const radii = strips.map((strip) => {
    const filter = getComputedStyle(strip).backdropFilter;
    const match = /^blur\(([\d.]+)px\)$/.exec(filter);
    if (!match) throw new Error(`Нет blur у полосы: ${filter}`);
    return Number(match[1]);
  });
  return {
    count: strips.length,
    strength: Math.sqrt(radii.reduce((sum, radius) => sum + radius * radius, 0)),
    masks: strips.map((strip) => getComputedStyle(strip).maskImage),
    children: veil.children.length,
  };
}

const api = {
  snapshot,
  font(value: number) {
    document.documentElement.style.fontSize = `${value}px`;
  },
  strength(value: string) {
    scope.style.setProperty('--lab-veil-strength', value);
  },
  feather(value: string) {
    scope.style.setProperty('--lab-veil-feather', value);
  },
  replace() {
    veil.replaceChildren();
  },
  dispose: release,
};
declare global {
  interface Window {
    __veilLength: typeof api;
  }
}
window.__veilLength = api;
