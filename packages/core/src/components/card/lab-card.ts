/**
 * `<lab-card>` владеет анатомией публикации; материал нижнего Content поставляет
 * @labpics/ui-materials. Действия принадлежат вложенным контролам, поэтому
 * presentational Card не создаёт собственную машину Behaviors.
 */
import { mountMaterialRuntime } from '@labpics/ui-materials';
import { materialCss } from '@labpics/ui-materials/css';
import { type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import '../badge/lab-badge.js';

/** Материал поверхности. */
export type LabCardVariant = 'elevated' | 'outlined' | 'filled';
/** Внутренние отступы Content. */
export type LabCardPadding = 'none' | 's' | 'm' | 'l';
/** Уровень собственного семантического заголовка. */
export type LabCardHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const materialStyles = unsafeCSS(materialCss);

export class LabCard extends LabElement {
  static override properties = {
    variant: { reflect: true },
    padding: { reflect: true },
    interactive: { type: Boolean, reflect: true },
    imageSrc: { attribute: 'image-src' },
    imageAlt: { attribute: 'image-alt' },
    heading: {},
    headingLevel: { type: Number, attribute: 'heading-level' },
    caption: {},
    description: {},
    lowerCaption: { attribute: 'lower-caption' },
    titleHint: { attribute: 'title-hint' },
    badge: {},
  };

  declare variant: LabCardVariant;
  declare padding: LabCardPadding;
  declare interactive: boolean;
  declare imageSrc: string;
  declare imageAlt: string;
  declare heading: string;
  declare headingLevel: LabCardHeadingLevel;
  declare caption: string;
  declare description: string;
  declare lowerCaption: string;
  declare titleHint: string;
  declare badge: string;

  private disposeMaterialRuntime?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    // Shadow-узлы сохраняются при reconnect; updated возвращает им runtime.
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.disposeMaterialRuntime?.();
    this.disposeMaterialRuntime = undefined;
    super.disconnectedCallback();
  }

  constructor() {
    super();
    this.variant = 'elevated';
    this.padding = 'l';
    this.interactive = false;
    this.imageSrc = '';
    this.imageAlt = '';
    this.heading = '';
    this.headingLevel = 2;
    this.caption = '';
    this.description = '';
    this.lowerCaption = '';
    this.titleHint = '';
    this.badge = '';
  }

  static override styles = [
    materialStyles,
    css`
      :host {
        --_pad: ${litVar('--lab-space-lg', '1.5rem')};
        --_radius: ${litVar('--lab-radius-card', '1rem')};
        display: block;
        min-inline-size: 0;
      }
      :host([padding='none']) { --_pad: 0; }
      :host([padding='s']) { --_pad: ${litVar('--lab-space-sm', '0.5rem')}; }
      :host([padding='m']) { --_pad: ${litVar('--lab-space-md', '1rem')}; }
      :host([padding='l']) { --_pad: ${litVar('--lab-space-lg', '1.5rem')}; }

      .card {
        --_border: transparent;
        position: relative;
        isolation: isolate;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        block-size: 100%;
        min-block-size: 0;
        overflow: auto;
        border-radius: var(--_radius);
        background-color: ${litVar('--lab-bg-primary')};
        color: ${litVar('--lab-label-primary')};
        font-family: ${litVar('--lab-font-family')};
      }
      /* INSIDE stroke рисуется поверх композиции, не меняя её размеры. */
      .card::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 2;
        box-sizing: border-box;
        border: ${litVar('--lab-stroke-hairline')} solid var(--_border);
        border-radius: inherit;
        pointer-events: none;
      }
      :host([variant='elevated']) .card {
        --_border: ${litVar('--lab-border-base')};
        background-color: transparent;
        box-shadow: var(--lab-elevation-resting);
      }
      :host([variant='outlined']) .card { --_border: ${litVar('--lab-border-base')}; }
      :host([variant='filled']) .card { background-color: ${litVar('--lab-fill-primary')}; }
      :host([interactive]) .card {
        cursor: pointer;
        transition: box-shadow var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
      }
      :host([interactive]:hover) .card { --_border: ${litVar('--lab-border-soft')}; }
      :host([interactive][variant='elevated']:hover) .card { box-shadow: var(--lab-elevation-raised); }
      .card:focus-visible,
      :host([interactive]:focus-within) .card {
        outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
        outline-offset: ${litVar('--lab-focus-ring-offset')};
      }

      .underlay {
        position: absolute;
        inset: 0;
        inline-size: 100%;
        block-size: 100%;
        object-fit: cover;
        pointer-events: none;
      }
      .image {
        position: relative;
        display: block;
        flex: 1 1 auto;
        min-block-size: 0;
        inline-size: 100%;
        object-fit: cover;
      }
      slot { display: contents; }
      ::slotted([slot='media']) {
        position: relative;
        display: block;
        inline-size: 100%;
      }
      .content {
        position: relative;
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
        gap: ${litVar('--lab-space-md', '1rem')};
        padding: var(--_pad);
        border-radius: 0;
      }
      .text-group {
        display: flex;
        flex-direction: column;
        gap: ${litVar('--lab-space-sm', '0.5rem')};
        min-inline-size: 0;
      }
      .text-main {
        display: flex;
        flex-direction: column;
        gap: calc(${litVar('--lab-space-xs', '0.25rem')} / 2);
      }
      .title-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: ${litVar('--lab-space-xs', '0.25rem')};
        min-inline-size: 0;
      }
      .heading,
      .title-hint {
        min-inline-size: 0;
        max-inline-size: 100%;
        margin: 0;
        font-size: ${litVar('--lab-font-size-card-title', '1.25rem')};
        font-weight: ${litVar('--lab-font-weight-medium')};
        line-height: ${litVar('--lab-line-height-card-title', '1')};
        letter-spacing: ${litVar('--lab-letter-spacing-card-title', '-0.0165em')};
      }
      .heading {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .title-hint {
        color: ${litVar('--lab-label-secondary')};
        overflow-wrap: anywhere;
      }
      .description {
        margin: 0;
        color: ${litVar('--lab-label-secondary')};
        font-size: ${litVar('--lab-font-size-card-description', '1rem')};
        font-weight: ${litVar('--lab-font-weight-regular')};
        line-height: ${litVar('--lab-line-height-card-description', '1.5')};
        letter-spacing: ${litVar('--lab-letter-spacing-card-description', '-0.015625em')};
      }
      .caption {
        margin: 0;
        color: ${litVar('--lab-label-secondary')};
        font-size: ${litVar('--lab-font-size-card-caption', '0.875rem')};
        font-weight: ${litVar('--lab-font-weight-medium')};
        line-height: ${litVar('--lab-line-height-card-caption', '0.8571428571428571')};
        letter-spacing: ${litVar('--lab-letter-spacing-card-caption', '0em')};
      }
      .description,
      .lower-caption {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
      }
    `,
  ];

  override updated(): void {
    if (!this.isConnected || this.variant !== 'elevated') {
      this.disposeMaterialRuntime?.();
      this.disposeMaterialRuntime = undefined;
      return;
    }
    if (this.disposeMaterialRuntime) return;
    const content = this.renderRoot.querySelector<HTMLElement>('.content');
    if (content) this.disposeMaterialRuntime = mountMaterialRuntime(content);
  }

  /** Геометрия source component.svg; цвет и размер задаёт общий Badge. */
  private renderBadgeGlyph(slot: 'leading' | 'trailing'): TemplateResult {
    return html`<svg slot=${slot} viewBox="0 0 12 12" width="12" height="12" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M5.5421 7.13265C5.8012 7.0406 6.0815 7.0298 6.34585 7.09895L6.4596 7.13365C6.63425 7.19605 6.7744 7.2966 6.8976 7.4022C7.01675 7.5043 7.1504 7.6384 7.3004 7.7884C7.45055 7.93855 7.5849 8.073 7.68715 8.1922C7.7929 8.31565 7.89375 8.4561 7.9562 8.6312L7.99085 8.74495C8.0597 9.00895 8.0486 9.2885 7.95665 9.5472L7.93125 9.61215C7.8687 9.7582 7.7798 9.87955 7.68715 9.98765C7.58495 10.1068 7.45055 10.2404 7.3004 10.3905C7.15035 10.5406 7.01675 10.675 6.8976 10.7772C6.7744 10.8828 6.6342 10.9833 6.4596 11.0458L6.34485 11.0804C6.08075 11.1493 5.80095 11.1383 5.5421 11.0463L5.4767 11.0204C5.3311 10.9579 5.21 10.8696 5.10215 10.7772C4.98297 10.675 4.84903 10.5402 4.69886 10.39C4.54883 10.24 4.41475 10.1063 4.31262 9.98715C4.22002 9.8791 4.13148 9.75805 4.06897 9.61215L4.04309 9.5472C3.95108 9.28815 3.93975 9.00775 4.00891 8.7435L4.04358 8.6312C4.10599 8.4561 4.20687 8.31565 4.31262 8.1922C4.4148 8.07305 4.54877 7.939 4.69886 7.7889C4.8489 7.63885 4.98301 7.50485 5.10215 7.40265C5.21005 7.3102 5.33115 7.2215 5.4767 7.159L5.5421 7.13265Z" />
      <path d="M2.45241 4.04337C2.67923 3.96266 2.92217 3.94378 3.15651 3.98673L3.25661 4.00919L3.37038 4.04385C3.5449 4.10631 3.68525 4.2069 3.80837 4.31241C3.92751 4.41457 4.06119 4.54863 4.2112 4.69864C4.36129 4.84872 4.49523 4.98277 4.59743 5.10198C4.69013 5.21013 4.77943 5.33128 4.84206 5.47743L4.86696 5.54143L4.90114 5.65323C4.97025 5.91738 4.95936 6.19803 4.86745 6.45693L4.84157 6.52238C4.77905 6.66823 4.69008 6.78928 4.59743 6.89738C4.49523 7.01658 4.36125 7.15063 4.2112 7.30068C4.06121 7.45068 3.9275 7.58478 3.80837 7.68693C3.68525 7.79243 3.54488 7.89303 3.37038 7.95548L3.25661 7.99013C2.99207 8.05938 2.71119 8.04823 2.45193 7.95598L2.38747 7.93058C2.24192 7.86803 2.12035 7.77888 2.01247 7.68643C1.89334 7.58423 1.75963 7.45018 1.60964 7.30018C1.45962 7.15018 1.32557 7.01653 1.22341 6.89738C1.13092 6.78943 1.04177 6.66853 0.979268 6.52288L0.953878 6.45693C0.861958 6.19798 0.851073 5.91788 0.920188 5.65373L0.919698 5.65323L0.954368 5.54143C1.01677 5.36623 1.11762 5.22588 1.22341 5.10243C1.32558 4.98326 1.45955 4.84921 1.60964 4.69913C1.75976 4.54901 1.8933 4.4146 2.01247 4.31241C2.1205 4.21981 2.24201 4.13131 2.38796 4.06876L2.38747 4.06827L2.45193 4.04288L2.45241 4.04337Z" />
      <path d="M8.63124 4.04347C8.89049 3.95123 9.17099 3.93962 9.43544 4.0088L9.54874 4.04347C9.72354 4.1059 9.86344 4.20688 9.98674 4.31251C10.1059 4.41469 10.24 4.54868 10.39 4.69874C10.5401 4.84883 10.6746 4.98288 10.7768 5.10209C10.8694 5.21019 10.9583 5.33149 11.0209 5.47754L11.0463 5.54154L11.0805 5.65479C11.1493 5.91869 11.1386 6.19839 11.0468 6.45704L11.0199 6.52299C10.9574 6.66854 10.8692 6.78959 10.7768 6.89749C10.6745 7.01669 10.5401 7.15069 10.39 7.30079C10.24 7.45084 10.1059 7.58484 9.98674 7.68704C9.86354 7.79259 9.72339 7.89314 9.54874 7.95559L9.43544 7.99024C9.17094 8.05949 8.89049 8.04834 8.63124 7.95609L8.56634 7.93069C8.42069 7.86814 8.29974 7.77904 8.19179 7.68654C8.07264 7.58439 7.93899 7.45034 7.78899 7.30029C7.63879 7.15009 7.50394 7.01669 7.40179 6.89749C7.33239 6.81654 7.26539 6.72809 7.20989 6.62744L7.15859 6.52249L7.13224 6.45704C7.04044 6.19844 7.02924 5.91869 7.09804 5.65479L7.09854 5.65529L7.13274 5.54154C7.19509 5.36639 7.29599 5.22599 7.40179 5.10254C7.50394 4.98334 7.63879 4.84943 7.78899 4.69923C7.93909 4.54912 8.07264 4.41468 8.19179 4.31251C8.29984 4.21994 8.42089 4.13091 8.56679 4.06837L8.63079 4.04298L8.63124 4.04347Z" />
      <path d="M5.54176 0.953496C5.76851 0.872836 6.01156 0.853951 6.24586 0.896856L6.34596 0.919316L6.45926 0.953986C6.63386 1.01641 6.77406 1.117 6.89726 1.22254C7.01641 1.3247 7.14996 1.45914 7.30006 1.60926C7.45021 1.75938 7.58461 1.89292 7.68681 2.01209C7.77946 2.12019 7.86876 2.24153 7.93141 2.38758L7.95631 2.45203L7.99051 2.56336C8.05966 2.82752 8.04871 3.1081 7.95681 3.36707L7.93091 3.43201C7.86841 3.57806 7.77941 3.69942 7.68681 3.8075C7.58456 3.92672 7.45026 4.06064 7.30006 4.21082C7.14996 4.36096 7.01641 4.49538 6.89726 4.59754C6.77406 4.7031 6.63386 4.80367 6.45926 4.8661L6.34596 4.90076C6.08151 4.96998 5.80051 4.9588 5.54131 4.86658L5.47731 4.84119C5.33131 4.77866 5.21046 4.68972 5.10231 4.59705C4.98308 4.49482 4.84863 4.36094 4.69851 4.21082C4.54844 4.06075 4.41445 3.92668 4.31228 3.8075C4.21972 3.69947 4.13064 3.57796 4.06814 3.43201L4.04275 3.36707C3.95086 3.10811 3.93992 2.82801 4.00906 2.56385L4.00857 2.56336L4.04324 2.45203C4.10564 2.2768 4.20646 2.13607 4.31228 2.01258C4.41439 1.89346 4.54852 1.75974 4.69851 1.60975C4.84866 1.4596 4.9831 1.32525 5.10231 1.22303C5.21021 1.13057 5.33116 1.0419 5.47681 0.979376L5.54131 0.953006L5.54176 0.953496Z" />
    </svg>`;
  }

  private renderHeading(): TemplateResult | typeof nothing {
    if (!this.heading) return nothing;
    switch (this.headingLevel) {
      case 1:
        return html`<h1 class="heading">${this.heading}</h1>`;
      case 3:
        return html`<h3 class="heading">${this.heading}</h3>`;
      case 4:
        return html`<h4 class="heading">${this.heading}</h4>`;
      case 5:
        return html`<h5 class="heading">${this.heading}</h5>`;
      case 6:
        return html`<h6 class="heading">${this.heading}</h6>`;
      default:
        return html`<h2 class="heading">${this.heading}</h2>`;
    }
  }

  override render(): TemplateResult {
    const hasTitle = Boolean(this.heading || this.titleHint || this.badge);
    const hasText = Boolean(this.caption || hasTitle || this.description || this.lowerCaption);
    return html`
      <article class="card" part="card" tabindex="0">
        ${
          this.imageSrc
            ? html`
          <img class="underlay" src=${this.imageSrc} alt="" aria-hidden="true" />
          <img class="image" src=${this.imageSrc} alt=${this.imageAlt} />
        `
            : html`<slot name="media"></slot>`
        }
        <div
          class=${this.variant === 'elevated' ? 'content lab-material lab-material--elevated' : 'content'}
          part="content"
        >
          <slot name="header">
            ${
              hasText
                ? html`<header class="text-group">
              ${this.caption ? html`<p class="caption">${this.caption}</p>` : nothing}
              ${
                hasTitle || this.description
                  ? html`<div class="text-main">
                ${
                  hasTitle
                    ? html`<div class="title-row">
                  ${this.renderHeading()}
                  ${this.titleHint ? html`<span class="title-hint">${this.titleHint}</span>` : nothing}
                  ${
                    this.badge
                      ? html`<lab-badge color="neutral" type="fill">
                    ${this.renderBadgeGlyph('leading')}${this.badge}${this.renderBadgeGlyph('trailing')}
                  </lab-badge>`
                      : nothing
                  }
                </div>`
                    : nothing
                }
                ${this.description ? html`<p class="description">${this.description}</p>` : nothing}
              </div>`
                  : nothing
              }
              ${this.lowerCaption ? html`<p class="caption lower-caption">${this.lowerCaption}</p>` : nothing}
            </header>`
                : nothing
            }
          </slot>
          <slot></slot>
          <slot name="footer"></slot>
        </div>
      </article>
    `;
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
