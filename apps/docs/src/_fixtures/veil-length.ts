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

let slotted:
  | {
      root: ShadowRoot;
      surface: HTMLElement;
      reference: HTMLElement;
      first: HTMLElement;
      firstSlot: HTMLSlotElement;
      secondSlot: HTMLSlotElement;
      release: () => void;
    }
  | undefined;

const api = {
  snapshot,
  startSlot(appLevel: boolean, materialClass: boolean) {
    if (slotted) throw new Error('Слот уже подключён');
    release();
    const shell = document.createElement('div');
    document.body.appendChild(shell);
    const root = shell.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${materialCss}
      .first{--lab-veil-strength:32px}
      .first.alt{--lab-veil-strength:48px}
      .first.invalid{--lab-veil-feather:50%}
      .second{--lab-veil-strength:40px}
      </style><div class="first"><slot name="first"></slot></div><div class="second"><slot name="second"></slot></div>`;
    const surface = document.createElement('div');
    surface.className = materialClass ? 'lab-material veil' : 'veil';
    surface.dataset.veil = 'bottom';
    surface.slot = 'first';
    const reference = document.createElement('div');
    reference.className = 'reference';
    reference.slot = 'first';
    shell.append(surface, reference);
    const first = root.querySelector<HTMLElement>('.first');
    const firstSlot = root.querySelector<HTMLSlotElement>('.first slot');
    const secondSlot = root.querySelector<HTMLSlotElement>('.second slot');
    if (!first || !firstSlot || !secondSlot) throw new Error('Нет доступных обёрток слота');
    slotted = {
      root,
      surface,
      reference,
      first,
      firstSlot,
      secondSlot,
      release: mountMaterialRuntime(appLevel ? document : surface),
    };
  },
  slotSnapshot() {
    if (!slotted) throw new Error('Нет слота');
    return {
      ...snapshot(slotted.surface, slotted.reference),
      slotContext: slotted.surface.assignedSlot?.parentElement?.className,
    };
  },
  slotClass(value: '' | 'alt' | 'invalid') {
    if (!slotted) throw new Error('Нет слота');
    slotted.first.className = `first ${value}`.trim();
  },
  slotRename(restore = false) {
    if (!slotted) throw new Error('Нет слота');
    slotted.firstSlot.name = restore ? 'first' : 'retired';
    slotted.secondSlot.name = restore ? 'second' : 'first';
  },
  disposeSlot() {
    if (!slotted) throw new Error('Нет слота');
    slotted.release();
  },
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
