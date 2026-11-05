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

type LateSlotTopology = 'assigned' | 'descendant' | 'nested' | 'fallback' | 'slot';

// Как Card: render создаёт приватную content со слотами, updated монтирует
// этот scope, disconnectedCallback освобождает его, reconnect монтирует заново.
class LateSlotConsumer extends HTMLElement {
  private releaseRuntime?: () => void;

  connectedCallback(): void {
    if (this.shadowRoot) this.updated();
  }

  disconnectedCallback(): void {
    this.disposeRuntime();
  }

  render(): void {
    if (!lateSlot || lateSlot.host !== this) throw new Error('Нет владельца позднего слота');
    if (this.shadowRoot) throw new Error('Поздний слот уже отрисован');
    const root = this.attachShadow({ mode: 'open' });
    const topology = lateSlot.topology;
    const slot =
      topology === 'fallback'
        ? '<slot name="body"><div class="veil" data-veil="bottom"></div><div class="reference"></div></slot>'
        : topology === 'nested'
          ? '<div class="forwarder"><slot name="body" slot="forwarded"></slot></div>'
          : '<slot name="body"></slot>';
    root.innerHTML = `<style>${materialCss}
      .content{--lab-veil-strength:32px}
      .content.strong{--lab-veil-strength:48px}
      .content.invalid{--lab-veil-feather:50%}
      .veil,.reference{width:200px;height:200px}
      .reference{filter:blur(var(--lab-veil-strength))}
      </style><section class="content lab-material" part="content">${slot}</section>`;
    if (topology === 'fallback') {
      const surface = root.querySelector<HTMLElement>('.veil');
      const reference = root.querySelector<HTMLElement>('.reference');
      if (!surface || !reference) throw new Error('Нет fallback слота');
      lateSlot.surface = surface;
      lateSlot.reference = reference;
    } else if (topology === 'nested') {
      const forwarder = root.querySelector('.forwarder');
      if (!forwarder) throw new Error('Нет владельца вложенного слота');
      const nested = forwarder.attachShadow({ mode: 'open' });
      nested.innerHTML = `<style>${materialCss}
        .private{width:200px;height:200px;filter:blur(var(--lab-veil-strength))}
        </style><div><slot name="forwarded"></slot><div class="private" data-veil="bottom"></div></div>`;
    }
    lateSlot.order.push('render-complete');
    this.updated();
  }

  renderedScope(): HTMLElement {
    const scope = this.shadowRoot?.querySelector<HTMLElement>(
      lateSlot?.topology === 'slot' ? 'slot' : '.content',
    );
    if (!scope) throw new Error('Нет отрисованного scope');
    return scope;
  }

  updated(): void {
    if (!this.isConnected || this.releaseRuntime) return;
    this.releaseRuntime = mountMaterialRuntime(this.renderedScope());
    lateSlot?.order.push('scoped-mounted');
  }

  disposeRuntime(): void {
    this.releaseRuntime?.();
    this.releaseRuntime = undefined;
  }
}

let lateSlot:
  | {
      host: LateSlotConsumer;
      surface: HTMLElement;
      reference: HTMLElement;
      kind: 'upgrade' | 'defined';
      topology: LateSlotTopology;
      initialRelease: () => void;
      overlapRelease?: () => void;
      order: string[];
    }
  | undefined;

const api = {
  snapshot,
  startLateSlot(
    kind: 'upgrade' | 'defined',
    topology: LateSlotTopology,
    owner: 'document' | 'surface' | 'none',
    materialClass = false,
  ) {
    if (lateSlot) throw new Error('Поздний слот уже создан');
    release();
    if (kind === 'defined') customElements.define('veil-late-consumer', LateSlotConsumer);
    const host = document.createElement('veil-late-consumer') as LateSlotConsumer;
    host.style.setProperty('--lab-veil-strength', '20px');
    const surface = document.createElement('div');
    surface.className = materialClass ? 'veil lab-material' : 'veil';
    surface.dataset.veil = 'bottom';
    const reference = document.createElement('div');
    reference.className = 'reference';
    if (topology === 'descendant') {
      const container = document.createElement('div');
      container.slot = 'body';
      container.append(surface, reference);
      host.appendChild(container);
    } else {
      surface.slot = reference.slot = topology === 'fallback' ? 'external' : 'body';
      host.append(surface, reference);
    }
    lateSlot = {
      host,
      surface,
      reference,
      kind,
      topology,
      initialRelease: () => {},
      order: kind === 'defined' ? ['definition-complete'] : [],
    };
    document.body.appendChild(host);
    lateSlot.initialRelease =
      owner === 'none' ? () => {} : mountMaterialRuntime(owner === 'document' ? document : surface);
    lateSlot.order.push('initial-mounted');
  },
  renderLateSlot() {
    if (!lateSlot) throw new Error('Нет позднего слота');
    if (lateSlot.kind === 'upgrade') {
      customElements.define(
        'veil-late-consumer',
        class extends LateSlotConsumer {
          override connectedCallback(): void {
            super.connectedCallback();
            if (!this.shadowRoot) this.render();
          }
        },
      );
      lateSlot.order.push('definition-complete');
    } else lateSlot.host.render();
  },
  lateSlotSnapshot() {
    if (!lateSlot) throw new Error('Нет позднего слота');
    const privateSurface = lateSlot.host.shadowRoot
      ?.querySelector('.forwarder')
      ?.shadowRoot?.querySelector<HTMLElement>('.private');
    return {
      ...snapshot(lateSlot.surface, lateSlot.reference),
      rootTypes:
        lateSlot.host.shadowRoot?.querySelectorAll('.lab-material__length-types').length ?? 0,
      privateCount: privateSurface?.querySelectorAll('.lab-veil__strip').length ?? 0,
      privateBox: privateSurface ? [privateSurface.offsetWidth, privateSurface.offsetHeight] : null,
      privateNative: privateSurface ? getComputedStyle(privateSurface).filter : null,
      order: [...lateSlot.order],
    };
  },
  lateSlotClass(value: '' | 'strong' | 'invalid') {
    const content = lateSlot?.host.shadowRoot?.querySelector('.content');
    if (!content) throw new Error('Нет Content позднего слота');
    content.className = `content lab-material ${value}`.trim();
  },
  lateSlotEnable(enabled: boolean) {
    if (!lateSlot) throw new Error('Нет позднего слота');
    if (enabled) lateSlot.surface.dataset.veil = 'bottom';
    else lateSlot.surface.removeAttribute('data-veil');
  },
  lateSlotReplace() {
    if (!lateSlot) throw new Error('Нет позднего слота');
    const surface = document.createElement('div');
    surface.className = 'veil';
    surface.dataset.veil = 'bottom';
    lateSlot.surface.replaceWith(surface);
    lateSlot.surface = surface;
  },
  lateSlotConnect(connected: boolean) {
    if (!lateSlot) throw new Error('Нет позднего слота');
    if (connected) document.body.appendChild(lateSlot.host);
    else lateSlot.host.remove();
  },
  overlapLateSlot(scope: 'content' | 'nested' = 'content') {
    if (!lateSlot) throw new Error('Нет позднего слота');
    const surface =
      scope === 'content'
        ? lateSlot.host.renderedScope()
        : lateSlot.host.shadowRoot
            ?.querySelector('.forwarder')
            ?.shadowRoot?.querySelector<HTMLElement>('.private');
    if (!surface) throw new Error('Нет приватной поверхности');
    lateSlot.overlapRelease = mountMaterialRuntime(surface);
  },
  releaseLateSlot(owner: 'component' | 'overlap' | 'all') {
    if (!lateSlot) throw new Error('Нет позднего слота');
    if (owner !== 'overlap') lateSlot.host.disposeRuntime();
    if (owner !== 'component') lateSlot.overlapRelease?.();
    if (owner === 'all') lateSlot.initialRelease();
  },
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
