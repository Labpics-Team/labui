/**
 * `<lab-avatar>` — a circular avatar with an honest image→initials fallback and
 * an optional status dot.
 *
 * Axes (the Figma Avatar model — 10 colour variants + a 4-state status dot):
 *   - size:   s | m | l
 *   - color:  neutral | brand | danger | warning | success | info
 *             (the tinted background + matching label the initials paint from)
 *   - status: none | online | offline | away | dnd
 *             (the corner indicator; sentiment roles carry the meaning)
 *   - src:    image URL — when present and it loads, the image wins
 *   - name:   used to derive initials AND as the accessible name
 *
 * Avatar is PRESENTATIONAL — it has no interaction state a machine would own (no
 * open/value/pressed/roving/typeahead). Image-load fallback is local view state,
 * not a shared interaction state machine, so per core-CONTRACT §1 it legitimately
 * opts out of the Zag seam and extends `LabElement` only for the base
 * conventions. (craft-arch: no onion for a picture in a circle.)
 *
 * HONEST FALLBACK (owner's iron rule on stop-gaps): the resolution is
 *   image (if `src` set AND it loads)  →  initials (derived from `name`)  →
 *   a neutral default glyph.
 * No broken-image icon is dressed up as a face; if the image errors, the element
 * falls back to initials for real (an `error` listener flips local state).
 *
 * a11y: with an image, the `<img>` carries `alt` = `name`. Without one, the host
 * exposes `role="img"` + `aria-label` = `name` so the initials are announced as a
 * named avatar, not read letter-by-letter. The status dot adds a visually-hidden
 * label so its meaning is not colour-only.
 *
 * Token contract (core-CONTRACT §2): initials backgrounds read
 * `--lab-fill-{family}-primary` tints with `--lab-label-{family}-primary` text;
 * the status dot reads the sentiment `-strong` borders; the ring that separates
 * the dot from the avatar reads a background role. No hex, no primitive.
 */
import { type PropertyValues, type TemplateResult, css, html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';

/** Avatar size. */
export type LabAvatarSize = 's' | 'm' | 'l';
/** Initials background / label colour family. */
export type LabAvatarColor = 'neutral' | 'brand' | 'danger' | 'warning' | 'success' | 'info';
/** Presence indicator. `none` hides the dot. */
export type LabAvatarStatus = 'none' | 'online' | 'offline' | 'away' | 'dnd';

/** Human-readable meaning for each status, used as the dot's accessible name. */
const STATUS_LABEL: Record<Exclude<LabAvatarStatus, 'none'>, string> = {
  online: 'Online',
  offline: 'Offline',
  away: 'Away',
  dnd: 'Do not disturb',
};

export class LabAvatar extends LabElement {
  static override properties = {
    size: { reflect: true },
    color: { reflect: true },
    status: { reflect: true },
    src: {},
    name: {},
    _imageFailed: { state: true },
  };

  declare size: LabAvatarSize;
  declare color: LabAvatarColor;
  declare status: LabAvatarStatus;
  declare src?: string;
  declare name: string;
  /** Local view state: the image errored, so fall back to initials for real. */
  private _imageFailed = false;

  constructor() {
    super();
    this.size = 'm';
    this.color = 'neutral';
    this.status = 'none';
    this.name = '';
  }

  /** Initials from the name: first letters of the first two words, uppercased. */
  private get initials(): string {
    const words = this.name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    const first = words[0]?.[0] ?? '';
    const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
    return (first + second).toUpperCase();
  }

  override willUpdate(changed: PropertyValues<this>): void {
    // A new src is a fresh image attempt — clear the previous failure.
    if (changed.has('src')) this._imageFailed = false;
  }

  static override styles = css`
    :host {
      --_diameter: ${litVar('--lab-size-avatar-m', '2.5rem')};
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
      --_dot: ${litVar('--lab-size-avatar-dot-m', '0.75rem')}; /* dot as token (derivation open per ADR) */

      display: inline-flex;
      vertical-align: middle;
    }

    :host([size='s']) {
      --_diameter: ${litVar('--lab-size-avatar-s', '1.75rem')};
      --_font: ${litVar('--lab-font-size-xxs', '0.6944rem')};
      --_dot: ${litVar('--lab-size-avatar-dot-s', '0.625rem')};
    }
    :host([size='l']) {
      --_diameter: ${litVar('--lab-size-avatar-l', '3.5rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};
      --_dot: ${litVar('--lab-size-avatar-dot-l', '1rem')};
    }

    .avatar {
      box-sizing: border-box;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--_diameter);
      height: var(--_diameter);
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      overflow: hidden;
      /* Default fallback surface: a neutral tinted disc with primary-label text. */
      background-color: ${litVar('--lab-fill-primary')};
      color: ${litVar('--lab-label-primary')};
      font: inherit;
      font-size: var(--_font);
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
      line-height: 1;
      user-select: none;
    }

    /* Initials colour families — tinted background + matching sentiment label. */
    :host([color='brand']) .avatar {
      background-color: ${litVar('--lab-fill-brand-primary')};
      color: ${litVar('--lab-label-brand-primary')};
    }
    :host([color='danger']) .avatar {
      background-color: ${litVar('--lab-fill-danger-primary')};
      color: ${litVar('--lab-label-danger-primary')};
    }
    :host([color='warning']) .avatar {
      background-color: ${litVar('--lab-fill-warning-primary')};
      color: ${litVar('--lab-label-warning-primary')};
    }
    :host([color='success']) .avatar {
      background-color: ${litVar('--lab-fill-success-primary')};
      color: ${litVar('--lab-label-success-primary')};
    }
    :host([color='info']) .avatar {
      background-color: ${litVar('--lab-fill-info-primary')};
      color: ${litVar('--lab-label-info-primary')};
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      /* The image fills the disc; if it fails, the host re-renders to initials. */
    }

    /* ── Status dot ────────────────────────────────────────────────────────── */
    .status {
      position: absolute;
      right: 0;
      bottom: 0;
      width: var(--_dot);
      height: var(--_dot);
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      /* A ring in the surrounding background so the dot reads as separate even on
         a same-colour avatar — separation by surface, not a hairline. */
      box-shadow: 0 0 0 ${litVar('--lab-stroke-thick')} ${litVar('--lab-bg-primary')};
    }
    :host([status='online']) .status {
      background-color: ${litVar('--lab-border-success-strong')};
    }
    :host([status='away']) .status {
      background-color: ${litVar('--lab-border-warning-strong')};
    }
    :host([status='dnd']) .status {
      background-color: ${litVar('--lab-border-danger-strong')};
    }
    :host([status='offline']) .status {
      background-color: ${litVar('--lab-fill-neutral')};
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  override render(): TemplateResult {
    const showImage = Boolean(this.src) && !this._imageFailed;
    const initials = this.initials;
    // Without an image, the host is `role="img"` (WCAG 4.1.2 needs a real name for
    // that role) — an unnamed avatar (no `name` prop) still renders the honest
    // neutral placeholder glyph, so it needs an honest generic fallback name
    // rather than an empty aria-label (axe `role-img-alt`). With an image, `alt`
    // on the <img> itself carries the name (empty alt there is a valid "decorative
    // image" signal, so no fallback is forced onto that path).
    const accessibleName = showImage ? this.name : this.name || 'Avatar';
    const statusLabel = this.status !== 'none' ? STATUS_LABEL[this.status] : undefined;

    return html`
      <span
        class="avatar"
        part="avatar"
        role=${ifDefined(showImage ? undefined : 'img')}
        aria-label=${ifDefined(showImage ? undefined : accessibleName)}
      >
        ${
          showImage
            ? html`<img
                src=${ifDefined(this.src)}
                alt=${this.name}
                @error=${this._onImageError}
              />`
            : initials
              ? html`<span aria-hidden="true">${initials}</span>`
              : html`<svg
                  part="placeholder"
                  viewBox="0 0 24 24"
                  width="60%"
                  height="60%"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v1h16v-1c0-3.3-3.6-6-8-6Z"
                  />
                </svg>`
        }
        ${statusLabel ? html`<span class="status" part="status"></span>` : ''}
      </span>
      ${statusLabel ? html`<span class="sr-only">${statusLabel}</span>` : ''}
    `;
  }

  private readonly _onImageError = (): void => {
    // Honest fallback: the image truly failed, so drop to initials/default.
    this._imageFailed = true;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-avatar': LabAvatar;
  }
}

// Idempotent registration (core-CONTRACT §7).
if (typeof customElements !== 'undefined' && !customElements.get('lab-avatar')) {
  customElements.define('lab-avatar', LabAvatar);
}
