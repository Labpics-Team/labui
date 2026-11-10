import { LabElement } from '@labpics/ui-core';
import { html } from 'lit';
import { property } from 'lit/decorators.js';

class BooleanView extends LabElement {
  renders = 0;
  protected override render() {
    this.renders++;
    return html`<output>${String(Reflect.get(this, 'flag'))}</output>`;
  }
}

export class BooleanDecorated extends BooleanView {
  @property({ type: Boolean, reflect: true }) accessor flag = false;
}

export class BooleanManual extends BooleanView {
  static override properties = { flag: { type: Boolean, noAccessor: true, reflect: true } };
  private value = false;
  get flag() {
    return this.value;
  }
  set flag(value: boolean) {
    const old = this.value;
    this.value = value;
    this.requestUpdate('flag', old);
  }
}

export class BooleanData extends BooleanView {
  static override properties = { flag: { type: Boolean, noAccessor: true } };
  flag = false;
}

export class BooleanCoercing extends BooleanView {
  static override properties = { flag: { type: Boolean, noAccessor: true } };
  private value = false;
  get flag() {
    return this.value;
  }
  set flag(value: boolean | { enabled: boolean }) {
    const old = this.value;
    this.value = typeof value === 'boolean' ? value : value.enabled;
    this.requestUpdate('flag', old);
  }
}

export class BooleanUnobservable extends BooleanView {
  static override properties = {
    flag: { type: Boolean },
    blocked: { type: Boolean, noAccessor: true },
  };
  declare flag: boolean;
  constructor() {
    super();
    this.flag = false;
    Object.defineProperty(this, 'blocked', { value: false, writable: true, configurable: false });
  }
}

export function registerBooleanExtensions() {
  for (const [name, ctor] of [
    ['lab-boolean-decorated', BooleanDecorated],
    ['lab-boolean-manual', BooleanManual],
    ['lab-boolean-data', BooleanData],
    ['lab-boolean-coercing', BooleanCoercing],
    ['lab-boolean-unobservable', BooleanUnobservable],
  ] as const) {
    if (!customElements.get(name)) customElements.define(name, ctor);
  }
}
