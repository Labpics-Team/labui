import { type TemplateResult, css, html, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import { type LabKbdSize, kbdSize } from './contract.js';
import { kbdCss } from './styles.js';

export type { LabKbdSize } from './contract.js';

/** Keyboard input: one key from the default slot, or an ordered chord from keys. */
export class LabKbd extends LabElement {
  static override properties = {
    size: { reflect: true },
    keys: { type: Array },
  };
  declare size: LabKbdSize;
  declare keys: readonly string[];

  constructor() {
    super();
    this.size = 's';
    this.keys = [];
  }

  static override styles = [
    css`:host { display: inline-flex; vertical-align: middle; }`,
    unsafeCSS(kbdCss),
  ];

  override render(): TemplateResult {
    return this.keys.length
      ? html`<kbd part="chord" data-lab-kbd data-size=${kbdSize(this.size)}>${this.keys.map(
          (key) => html`<kbd class="lab-kbd-key" part="key">${key}</kbd>`,
        )}</kbd>`
      : html`<kbd part="key" data-lab-kbd data-size=${kbdSize(this.size)} class="lab-kbd-key"><slot></slot></kbd>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-kbd': LabKbd;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-kbd'))
  customElements.define('lab-kbd', LabKbd);
