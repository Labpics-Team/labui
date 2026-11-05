import { mountMaterialRuntime } from '@labpics/ui-materials';
import { materialCss } from '@labpics/ui-materials/css';

const style = document.createElement('style');
style.textContent = materialCss;
document.head.appendChild(style);
const scope = document.querySelector<HTMLElement>('.scope');
const veil = document.querySelector<HTMLElement>('.veil');
if (!scope || !veil) throw new Error('Нет поверхности для проверки длин');
const scenario = document.createElement('style');
scenario.textContent = new URL(window.location.href).searchParams.get('css') ?? '';
document.head.appendChild(scenario);
const release = mountMaterialRuntime(scope);

function snapshot(
  surface: HTMLElement | null = veil,
  reference: Element | null = document.querySelector('.reference'),
) {
  if (!surface || !reference) throw new Error('Поверхность удалена');
  const strips = [...surface.querySelectorAll<HTMLElement>('.lab-veil__strip')];
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
    children: surface.children.length,
    native: getComputedStyle(reference).filter,
    box: [surface.offsetWidth, surface.offsetHeight],
    types: document.querySelectorAll('.lab-material__length-types').length,
  };
}

let shadow:
  | {
      shell: HTMLElement;
      root: ShadowRoot;
      scope: HTMLElement;
      surface: HTMLElement;
      reference: HTMLElement;
      release: () => void;
    }
  | undefined;

const api = {
  snapshot,
  startShadow(mode: ShadowRootMode) {
    const shell = document.createElement('div');
    document.body.appendChild(shell);
    const root = shell.attachShadow({ mode });
    root.innerHTML = `<style>${materialCss}
      .scope{font-size:24px;--lab-veil-strength:calc(1rem + .5em)}
      .veil,.reference{width:200px;height:200px}
      .reference{filter:blur(var(--lab-veil-strength))}
      </style><div class="scope"><div class="veil" data-veil="bottom"></div><div class="reference"></div></div>`;
    const local = root.querySelector<HTMLElement>('.scope');
    const surface = root.querySelector<HTMLElement>('.veil');
    const reference = root.querySelector<HTMLElement>('.reference');
    if (!local || !surface || !reference) throw new Error('Нет поверхности Shadow DOM');
    shadow = {
      shell,
      root,
      scope: local,
      surface,
      reference,
      release: mountMaterialRuntime(local),
    };
  },
  shadowSnapshot() {
    if (!shadow) throw new Error('Нет Shadow DOM');
    return {
      ...snapshot(shadow.surface, shadow.reference),
      rootTypes: shadow.root.querySelectorAll('.lab-material__length-types').length,
    };
  },
  shadowFont(value: number) {
    if (!shadow) throw new Error('Нет Shadow DOM');
    shadow.scope.style.fontSize = `${value}px`;
  },
  stopShadow() {
    if (!shadow) throw new Error('Нет Shadow DOM');
    shadow.release();
    shadow.shell.remove();
    shadow = undefined;
  },
  css(value: string) {
    scenario.textContent = value;
  },
  containerWidth(value: number) {
    scope.style.width = `${value}px`;
  },
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
