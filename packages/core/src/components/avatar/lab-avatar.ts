import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { keyed } from 'lit/directives/keyed.js';
import { LabElement } from '../../lit/lab-element.js';
import {
  type LabAvatarColor,
  type LabAvatarFallback,
  type LabAvatarSize,
  type LabAvatarStatus,
  avatarColor,
  avatarDefaults,
  avatarInitials,
  avatarName,
  avatarStatus,
  observeAvatarImage,
} from './contract.js';
import { avatarCss } from './styles.js';
export type {
  LabAvatarColor,
  LabAvatarFallback,
  LabAvatarSize,
  LabAvatarStatus,
} from './contract.js';

/** Authored Avatar material and letter mark, with a decoded image and an independent presence dot. */
export class LabAvatar extends LabElement {
  static override properties = {
    size: { reflect: true },
    color: { reflect: true },
    status: { reflect: true },
    src: { reflect: true },
    name: { reflect: true },
    initials: { reflect: true },
    fallback: { reflect: true },
    decorative: { type: Boolean, reflect: true },
    statusLabel: { attribute: 'status-label', reflect: true },
    imageState: { state: true },
  };
  declare size: LabAvatarSize;
  declare color: LabAvatarColor;
  declare status: LabAvatarStatus;
  declare src?: string;
  declare name: string;
  declare initials?: string;
  declare fallback: LabAvatarFallback;
  declare decorative: boolean;
  declare statusLabel: string;
  private declare imageState: 'loading' | 'ready' | 'error';
  private image?: HTMLImageElement;
  private stopImage?: () => void;

  constructor() {
    super();
    this.size = 'm';
    this.color = avatarDefaults.color;
    this.status = 'none';
    this.name = '';
    this.fallback = avatarDefaults.fallback;
    this.decorative = false;
    this.statusLabel = '';
    this.imageState = 'loading';
  }
  static override styles = [
    unsafeCSS(avatarCss),
    css`:host { display:inline-flex; vertical-align:middle; flex:none; }`,
  ];
  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('src')) {
      this.stopImage?.();
      this.image = undefined;
      this.imageState = 'loading';
    }
  }
  override updated(): void {
    const image = this.renderRoot.querySelector<HTMLImageElement>('.lab-avatar-image') ?? undefined;
    if (image === this.image) return;
    this.stopImage?.();
    this.image = image;
    if (image)
      this.stopImage = observeAvatarImage(image, (ready) => {
        this.imageState = ready ? 'ready' : 'error';
      });
  }
  override disconnectedCallback(): void {
    this.stopImage?.();
    this.stopImage = undefined;
    this.image = undefined;
    super.disconnectedCallback();
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }
  override render(): TemplateResult {
    const initials = this.fallback === 'texture' ? '' : avatarInitials(this.name, this.initials);
    const src = this.src?.trim();
    const state = src ? this.imageState : 'fallback';
    const status = avatarStatus(this.status);
    return html`<span data-lab-avatar data-size=${this.size} data-color=${avatarColor(this.color)} data-status=${status}
      data-image=${state} role=${ifDefined(this.decorative ? undefined : 'img')}
      aria-label=${ifDefined(this.decorative ? undefined : avatarName(this.name, status, this.statusLabel))}
      aria-hidden=${ifDefined(this.decorative ? 'true' : undefined)}>
      <span class="lab-avatar-disc" part="avatar" aria-hidden="true">
        ${initials ? html`<span class="lab-avatar-initials">${initials}</span>` : html`<span class="lab-avatar-texture"></span>`}
        ${src ? keyed(src, html`<img class="lab-avatar-image" src=${src} alt="" decoding="async" />`) : nothing}
      </span>
      ${status !== 'none' ? html`<span class="lab-avatar-status" part="status" aria-hidden="true"></span>` : nothing}
    </span>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-avatar': LabAvatar;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-avatar'))
  customElements.define('lab-avatar', LabAvatar);
