/**
 * `<lab-badge>` — неинтерактивная метка с семантическим цветом.
 * Default slot содержит текст; leading/trailing — декоративные иконки.
 * Прежний dot остаётся fallback для leading. Нейтральный Fill использует
 * инвертированные фон и текст исходника, остальные пары принадлежат Colors.
 */
import { type TemplateResult, css, html } from 'lit';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';

/** Семейство семантического цвета. */
export type LabBadgeColor =
  | 'neutral'
  | 'brand'
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
  | 'static-dark'
  | 'static-light';
/** Непрозрачная или полупрозрачная поверхность. */
export type LabBadgeType = 'fill' | 'tinted';

export class LabBadge extends LabElement {
  static override properties = {
    color: { reflect: true },
    type: { reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  declare color: LabBadgeColor;
  declare type: LabBadgeType;
  declare disabled: boolean;

  constructor() {
    super();
    this.color = 'neutral';
    this.type = 'fill';
    this.disabled = false;
  }

  static override styles = css`
    :host {
      --_radius: ${litVar('--lab-radius-full', '9999px')};
      --_font: ${litVar('--lab-font-size-badge-label', '0.75rem')};
      --_icon-size: ${litVar('--lab-size-control-s', '0.75rem')};
      --_pad-x: ${litVar('--lab-space-sm', '0.5rem')};
      --_pad-y: ${litVar('--lab-space-xs', '0.25rem')};
      --_gap: ${litVar('--lab-space-xs', '0.25rem')};

      display: inline-flex;
      vertical-align: middle;
    }

    .badge {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--_gap);
      min-height: ${litVar('--lab-size-control-l', '1.25rem')};
      padding: var(--_pad-y) var(--_pad-x);
      border-radius: var(--_radius);
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-badge-label', '1')};
      letter-spacing: ${litVar('--lab-letter-spacing-badge-label', '0em')};
      font-weight: ${litVar('--lab-font-weight-medium', '500')};
      white-space: nowrap;
      /* Base surface; the [color][type] rules set the longhands directly (the
         proto-A var()->var() shadow-boundary note — no intermediate --_bg). */
      background-color: transparent;
      color: ${litVar('--lab-label-primary')};
    }

    /* Пустые слоты не создают flex-items и промежутки до hydration. */
    slot { display: contents; }
    ::slotted([slot='leading']),
    ::slotted([slot='trailing']) {
      display: block;
      inline-size: var(--_icon-size);
      block-size: var(--_icon-size);
      flex: none;
      color: inherit;
    }
    /* Прежний dot сохраняет размер и фон индикатора. */
    ::slotted([slot='dot']) {
      display: inline-block;
      width: 0.5em;
      height: 0.5em;
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      background-color: currentColor;
      flex: none;
    }

    /* ── type=fill: opaque sentiment surface + contrast label ──────────────── */
    :host([type='fill'][color='neutral']) .badge {
      background-color: ${litVar('--lab-bg-inverted')};
      color: ${litVar('--lab-label-inverted-primary')};
    }
    :host([type='fill'][color='brand']) .badge {
      background-color: ${litVar('--lab-badge-fill-brand')};
      color: ${litVar('--lab-badge-label-on-brand')};
    }
    :host([type='fill'][color='danger']) .badge {
      background-color: ${litVar('--lab-badge-fill-danger')};
      color: ${litVar('--lab-badge-label-on-danger')};
    }
    :host([type='fill'][color='warning']) .badge {
      background-color: ${litVar('--lab-badge-fill-warning')};
      color: ${litVar('--lab-badge-label-on-warning')};
    }
    :host([type='fill'][color='success']) .badge {
      background-color: ${litVar('--lab-badge-fill-success')};
      color: ${litVar('--lab-badge-label-on-success')};
    }
    :host([type='fill'][color='info']) .badge {
      background-color: ${litVar('--lab-badge-fill-info')};
      color: ${litVar('--lab-badge-label-on-info')};
    }
    :host([type='fill'][color='static-dark']) .badge {
      background-color: ${litVar('--lab-badge-fill-static-dark')};
      color: ${litVar('--lab-badge-label-on-static-dark')};
    }
    :host([type='fill'][color='static-light']) .badge {
      background-color: ${litVar('--lab-badge-fill-static-light')};
      color: ${litVar('--lab-badge-label-on-static-light')};
    }

    /* ── type=tinted: low-alpha sentiment tint + sentiment label ───────────── */
    :host([type='tinted'][color='neutral']) .badge {
      background-color: ${litVar('--lab-fill-primary')};
      color: ${litVar('--lab-label-primary')};
    }
    :host([type='tinted'][color='brand']) .badge {
      background-color: ${litVar('--lab-fill-brand-primary')};
      color: ${litVar('--lab-label-brand-primary')};
    }
    :host([type='tinted'][color='danger']) .badge {
      background-color: ${litVar('--lab-fill-danger-primary')};
      color: ${litVar('--lab-label-danger-primary')};
    }
    :host([type='tinted'][color='warning']) .badge {
      background-color: ${litVar('--lab-fill-warning-primary')};
      color: ${litVar('--lab-label-warning-primary')};
    }
    :host([type='tinted'][color='success']) .badge {
      background-color: ${litVar('--lab-fill-success-primary')};
      color: ${litVar('--lab-label-success-primary')};
    }
    :host([type='tinted'][color='info']) .badge {
      background-color: ${litVar('--lab-fill-info-primary')};
      color: ${litVar('--lab-label-info-primary')};
    }
    /* Tinted static: полупрозрачный семейный тинт — лейбл СЕМЕЙНЫЙ примитив
       (канон Figma и React-близнеца); перекрёстные label-on-* — только для
       НЕПРОЗРАЧНЫХ fill-заливок закона пары. */
    :host([type='tinted'][color='static-dark']) .badge {
      background-color: ${litVar('--lab-fill-static-dark-primary')};
      color: ${litVar('--lab-label-static-dark-primary')};
    }
    :host([type='tinted'][color='static-light']) .badge {
      background-color: ${litVar('--lab-fill-static-light-primary')};
      color: ${litVar('--lab-label-static-light-primary')};
    }

    /* ── disabled: a dimmed, non-interactive presentation ──────────────────── */
    :host([disabled]) .badge {
      opacity: 0.45;
    }
  `;

  override render(): TemplateResult {
    return html`
      <span class="badge" part="badge">
        <slot name="leading" data-sizing="fill" aria-hidden="true"><slot name="dot" data-sizing="fill"></slot></slot>
        <slot></slot>
        <slot name="trailing" data-sizing="fill" aria-hidden="true"></slot>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-badge': LabBadge;
  }
}
