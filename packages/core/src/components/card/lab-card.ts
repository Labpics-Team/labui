import { materialCss } from '@labpics/ui-materials/css';
import { type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import { slotSizeCss } from '../../slot-projection.js';
import { mountCardRuntime } from './runtime.js';
import { cardCss } from './styles.js';

export type LabCardVariant = 'elevated' | 'outlined' | 'filled';
export type LabCardPadding = 'none' | 's' | 'm' | 'l';

/** Related content on one surface. Actions remain native controls inside it. */
export class LabCard extends LabElement {
  static override properties = {
    variant: { reflect: true },
    padding: { reflect: true },
    interactive: { type: Boolean, reflect: true },
    image: {},
    imageAlt: { attribute: 'image-alt' },
    heading: {},
    headingHint: { attribute: 'heading-hint' },
    description: {},
    caption: {},
    lowerCaption: { attribute: 'lower-caption' },
  };
  declare variant: LabCardVariant;
  declare padding: LabCardPadding;
  declare interactive: boolean;
  declare image: string;
  declare imageAlt: string;
  declare heading: string;
  declare headingHint: string;
  declare description: string;
  declare caption: string;
  declare lowerCaption: string;
  private runtime: ReturnType<typeof mountCardRuntime> | undefined;

  constructor() {
    super();
    this.variant = 'elevated';
    this.padding = 'l';
    this.interactive = false;
    this.image = '';
    this.imageAlt = '';
    this.heading = '';
    this.headingHint = '';
    this.description = '';
    this.caption = '';
    this.lowerCaption = '';
  }

  static override styles = [
    unsafeCSS(materialCss),
    unsafeCSS(cardCss),
    css`
      :host {
        --_card-slotted-top-radius: var(--lab-radius-card-surface);
        display: flex; flex-direction: column; min-width: 0;
      }
      .lab-card-content {
        border-start-start-radius: var(--_card-slotted-top-radius);
        border-start-end-radius: var(--_card-slotted-top-radius);
      }
      /* Media fills the card and keeps its natural aspect ratio. */
      ${unsafeCSS(slotSizeCss("::slotted([slot='media'])", '100%', 'auto'))}
      ::slotted([slot='media']) { display: block; }
    `,
  ];

  private readonly syncMedia = (): void => {
    const surface = this.renderRoot.querySelector<HTMLElement>('[data-lab-card]');
    if (!surface) return;
    const slot = surface.querySelector<HTMLSlotElement>('slot[name="media"]');
    surface.toggleAttribute('data-media', !!this.image || !!slot?.assignedElements().length);
    this.runtime?.refresh();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }

  override updated(): void {
    if (!this.isConnected) return;
    this.syncMedia();
    const surface = this.renderRoot.querySelector<HTMLElement>('[data-lab-card]');
    if (surface && !this.runtime) this.runtime = mountCardRuntime(surface);
  }

  override disconnectedCallback(): void {
    try {
      this.runtime?.dispose();
    } finally {
      this.runtime = undefined;
      super.disconnectedCallback();
    }
  }

  private textLayout(): TemplateResult | typeof nothing {
    if (!this.heading && !this.description && !this.caption && !this.lowerCaption) return nothing;
    return html`<div class="lab-card-text">
      ${this.caption ? html`<p class="lab-card-caption">${this.caption}</p>` : nothing}
      ${
        this.heading || this.description
          ? html`<div class="lab-card-title-group">
        ${
          this.heading
            ? html`<div class="lab-card-title-row">
          <h2 class="lab-card-title">${this.heading}</h2>
          ${this.headingHint ? html`<span class="lab-card-hint">${this.headingHint}</span>` : nothing}
          <slot name="badge"></slot>
        </div>`
            : nothing
        }
        ${this.description ? html`<p class="lab-card-description">${this.description}</p>` : nothing}
      </div>`
          : nothing
      }
      ${this.lowerCaption ? html`<p class="lab-card-caption">${this.lowerCaption}</p>` : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    return html`<article class="card" data-lab-card data-variant=${this.variant}
        data-padding=${this.padding} ?data-interactive=${this.interactive}
        ?data-image=${!!this.image} ?data-media=${!!this.image} part="card">
      ${this.image ? html`<div class="lab-card-image" aria-hidden="true"><img src=${this.image} alt="" /></div>` : nothing}
      <div class="lab-card-region lab-card-media">
        <slot name="media" @slotchange=${this.syncMedia}>
          ${this.image ? html`<img class="lab-card-default-image" src=${this.image} alt=${this.imageAlt} />` : nothing}
        </slot>
      </div>
      <div class=${this.variant === 'elevated' ? 'lab-card-content lab-material lab-material--elevated' : 'lab-card-content'} part="content">
        <header class="lab-card-region lab-card-header header">
          <slot name="header">${this.textLayout()}</slot>
        </header>
        <div class="lab-card-region lab-card-body body"><slot></slot></div>
        <footer class="lab-card-region lab-card-footer footer">
          <slot name="footer"></slot>
        </footer>
      </div>
    </article>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-card': LabCard;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-card')) {
  customElements.define('lab-card', LabCard);
}
