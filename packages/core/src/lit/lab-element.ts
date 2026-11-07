import type { MachineSchema } from '@zag-js/core';
/**
 * LabElement — the base class every LabUI Lit component extends.
 *
 * It encodes the conventions shared by all ~38 components so a component file
 * carries only its own visuals + machine choice, never boilerplate:
 *   - `delegatesFocus`: focusing the host moves focus to the inner interactive
 *     node, so host-level focus styling and tab order are correct (a11y).
 *   - `runMachine(module, getProps)`: one call wires a Zag behavior to this
 *     element through a `ZagController` (the Behaviors seam). The component does
 *     not touch `VanillaMachine` directly — it depends on the abstraction.
 *
 * It deliberately does NOT define styles, props, or a `render()`. Those are the
 * component's single responsibility; the base only owns cross-cutting wiring.
 * Theming is invisible here by design: the element reads semantic `--lab-*`
 * roles in its own styles and never branches on the active theme/material.
 */
import {
  type CSSResultGroup,
  type CSSResultOrNative,
  LitElement,
  type PropertyValues,
  css,
} from 'lit';
import type { MachineModule, MachineProps } from '../behaviors/types.js';
import {
  booleanSnapshotAttribute,
  captureBooleanWrites,
  parseBooleanSnapshot,
} from './boolean-snapshot.js';
import { ZagController } from './zag-controller.js';

/** Process-wide counter backing {@link LabElement.uid} — stable per instance. */
let labUidCounter = 0;

/**
 * Форма угла для shadow-контента: документные правила shadow-границу не
 * пересекают, а corner-shape не наследуется — лист добавляется каждому
 * компоненту через finalizeStyles (одна точка на всю систему). Значение ручки
 * приходит кастом-свойством (те наследуются): --lab-radius-corner-k из
 * токен-слоя. Без поддержки (не Chromium 139+) свойство игнорируется.
 */
const cornerShapeStyles = css`
  *,
  *::before,
  *::after {
    corner-shape: superellipse(var(--lab-radius-corner-k, 1.1));
  }
`;

export class LabElement extends LitElement {
  static override get observedAttributes(): string[] {
    // biome-ignore lint/complexity/noThisInStatic: getter Lit должен финализировать конкретный класс наследника
    return [...super.observedAttributes, booleanSnapshotAttribute];
  }

  private booleanSnapshotConsumed = false;
  private finishBooleanCapture?: () => ReadonlyMap<string, unknown> | undefined;

  protected override performUpdate(): void {
    if (!this.isUpdatePending) return;
    const finishCapture = this.finishBooleanCapture;
    this.finishBooleanCapture = undefined;
    // Временные own accessors удаляются до проверки class-field shadowing Lit.
    const writes = finishCapture?.();
    if (!writes) {
      super.performUpdate();
      return;
    }
    const shouldUpdate = this.shouldUpdate;
    const ownDescriptor = Object.getOwnPropertyDescriptor(this, 'shouldUpdate');
    try {
      // Штатный replay Lit предшествует shouldUpdate. Одноразовая обёртка
      // сохраняет shouldUpdate наследника без требования вызывать super.
      Object.defineProperty(this, 'shouldUpdate', {
        configurable: true,
        writable: true,
        value: (changed: PropertyValues) => {
          for (const [property, value] of writes) {
            if (!Reflect.set(this, property, value)) {
              throw new TypeError(`LabUI SSR: cannot restore Boolean property ${property}.`);
            }
          }
          return shouldUpdate.call(this, changed);
        },
      });
      super.performUpdate();
    } finally {
      if (ownDescriptor) Object.defineProperty(this, 'shouldUpdate', ownDescriptor);
      else Reflect.deleteProperty(this, 'shouldUpdate');
    }
  }

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (name !== booleanSnapshotAttribute) {
      super.attributeChangedCallback(name, old, value);
      return;
    }
    if (value === null) return;
    if (this.booleanSnapshotConsumed) {
      throw new TypeError('LabUI SSR: Boolean snapshot has already been consumed.');
    }
    const entries = parseBooleanSnapshot(this.constructor as typeof LabElement, value);
    this.booleanSnapshotConsumed = true;
    // При upgrade этот атрибут идёт последним, после обычных host attributes и
    // constructor, но до connectedCallback. После снимка отслеживаем только
    // новые записи до первого update; сам снимок в этот набор не входит.
    for (const [property, resolved] of entries) {
      if (!Reflect.set(this, property, resolved)) {
        throw new TypeError(`LabUI SSR: cannot restore Boolean property ${property}.`);
      }
    }
    this.finishBooleanCapture = captureBooleanWrites(this);
    this.removeAttribute(booleanSnapshotAttribute);
  }

  /** Форма угла — всем наследникам, поверх их собственных styles. */
  protected static override finalizeStyles(styles?: CSSResultGroup): Array<CSSResultOrNative> {
    // biome-ignore lint/complexity/noThisInStatic: super в статик-переопределении — точный механизм цепочки Lit (имя класса сломало бы промежуточных наследников)
    return [cornerShapeStyles, ...super.finalizeStyles(styles)];
  }

  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  /**
   * A stable, unique id for THIS instance — the Lit mirror of React's `useId`.
   * Generated once at construction and never reused, so a machine seeded with it
   * (`id: this.uid`) produces unique scoped ids per instance, never the colliding
   * `<component>:undefined:*` ids that result from passing no id at all. Scoped to
   * this element's shadow root anyway, so a plain counter is sufficient and
   * SSR-deterministic within a render pass.
   */
  protected readonly uid: string = `lab-${(labUidCounter++).toString(36)}`;

  /**
   * Whether this element has visible DEFAULT-slot content (i.e. a real label),
   * ignoring nodes assigned to a NAMED slot (decorative icons) and whitespace.
   * Used to decide the accessible-name source: a default-slot label feeds the
   * machine's `aria-labelledby`; without one, the control is named via
   * `aria-label`. Element children with a `slot=` attribute and whitespace-only
   * text nodes do not count.
   */
  protected hasDefaultSlotContent(): boolean {
    // SSR-safety: under @lit-labs/ssr the element instance has no traversable light
    // DOM, and the global DOM shim's `childNodes` is not iterable — iterating it
    // throws. We cannot know the slotted content at server render time, so assume the
    // common case (a visible default-slot label is present) and let client hydration
    // resolve the icon-only edge case. Client behaviour (iterable childNodes) is
    // unchanged; only the non-iterable SSR path is guarded.
    const nodes = this.childNodes as ArrayLike<Node> & { [Symbol.iterator]?: unknown };
    if (typeof nodes?.[Symbol.iterator] !== 'function') return true;
    for (const node of this.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent?.trim()) return true;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (!(node as Element).hasAttribute('slot')) return true;
      }
    }
    return false;
  }

  /**
   * Attach a Zag behavior to this element. Returns the controller so the
   * component can read `.api` in `render()`, `.spread()` nodes in `updated()`,
   * and `.send()` events from handlers.
   */
  protected runMachine<T extends MachineSchema, Api>(
    module: MachineModule<T, Api>,
    getProps: () => MachineProps<T>,
  ): ZagController<T, Api> {
    return new ZagController<T, Api>(this, module, getProps);
  }
}
