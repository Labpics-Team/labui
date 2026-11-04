import { mountMaterialRuntime } from '@labpics/ui-materials';
import { materialCss } from '@labpics/ui-materials/css';
import type * as dialogMachine from '@zag-js/dialog';
import { type TemplateResult, css, html, unsafeCSS } from 'lit';
import { litVar } from '../../css.js';
import { type SheetMotion, mountSheetMotion } from '../../motion/sheet.js';
import { LabModal } from '../dialog/modal.js';
import { type LabSheetPosition, parseSheetPosition, sheetGeometry } from './positions.js';

export type { LabSheetPosition } from './positions.js';
export interface SheetPositionChangeDetails {
  readonly position: LabSheetPosition;
}
export interface SheetMotionErrorDetails {
  readonly error: unknown;
}

const materialStyles = unsafeCSS(materialCss);
const sheetStyles = css`
  :host {
    --_sheet-inset: ${litVar('--lab-space-sheet-inset', '1rem')};
    --_sheet-gap: ${litVar('--lab-space-sheet-gap', '1.5rem')};
    --_sheet-overlap: ${litVar('--lab-space-sheet-overlap', '2rem')};
    color: ${litVar('--lab-label-primary')};
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: ${litVar('--lab-z-modal-underlay', '1100')};
    pointer-events: auto;
  }
  .backdrop[hidden], .positioner[hidden], .content[hidden] {
    display: none;
  }
  .positioner {
    position: fixed;
    inset: 0;
    height: 100dvh;
    overflow: clip;
    pointer-events: none;
    z-index: ${litVar('--lab-z-modal', '1200')};
  }
  .sheet-frame {
    --_sheet-top: 0px;
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .ghost {
    --lab-veil-strength: ${litVar('--lab-size-sheet-ghost-blur', '1.5rem')};
    position: absolute;
    inset: 0 0 auto;
    height: min(100%, calc(var(--_sheet-top) + var(--_sheet-overlap)));
    pointer-events: none;
    background: ${litVar('--lab-bg-overlay-ghost')};
  }
  .content {
    box-sizing: border-box;
    position: absolute;
    inset: var(--_sheet-top) 0 0;
    min-width: 0;
    min-height: 0;
    border-radius: ${litVar('--lab-radius-sheet', '2rem')} ${litVar('--lab-radius-sheet', '2rem')} 0 0;
    corner-shape: superellipse(var(--lab-radius-corner-k, 1.1));
    color: ${litVar('--lab-label-primary')};
    font: inherit;
    font-size: ${litVar('--lab-font-size-md', '1rem')};
    letter-spacing: ${litVar('--lab-letter-spacing-md', '-0.0083em')};
    line-height: ${litVar('--lab-line-height-md', '1.5')};
  }
  .surface {
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--_sheet-panel-gap, 0px);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    padding: 0 var(--_sheet-inset) var(--_sheet-inset);
    border-radius: inherit;
    corner-shape: inherit;
    box-shadow: var(--lab-elevation-modal);
  }
  .content:focus-visible, .handle:focus-visible, .close:focus-visible {
    outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
    outline-offset: calc(-1 * ${litVar('--lab-focus-ring-offset')});
  }
  .handle {
    position: relative;
    flex: none;
    width: 100%;
    height: ${litVar('--lab-size-sheet-drag-area', '1.5rem')};
    padding: 0;
    border: 0;
    background: none;
    touch-action: none;
    cursor: grab;
  }
  .handle[data-dragging] { cursor: grabbing; }
  .indicator {
    position: absolute;
    top: ${litVar('--lab-size-sheet-indicator-y', '0.875rem')};
    left: 50%;
    width: ${litVar('--lab-size-sheet-indicator-w', '2.25rem')};
    height: ${litVar('--lab-size-sheet-indicator-h', '0.25rem')};
    transform: translateX(calc(-50% + ${litVar('--lab-size-sheet-indicator-x', '0.0313rem')}));
    border-radius: ${litVar('--lab-radius-pill', '9999px')};
    background: ${litVar('--lab-label-tertiary')};
    pointer-events: none;
  }
  .panel-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--_sheet-body-gap, 0px);
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .body { display: block; flex: none; }
  .panel-heading {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: var(--_sheet-gap);
  }
  .heading, .description { flex: none; margin: 0; }
  .heading {
    font-size: ${litVar('--lab-font-size-lg', '1.2rem')};
    letter-spacing: ${litVar('--lab-letter-spacing-lg', '-0.0194em')};
  }
  .description { color: ${litVar('--lab-label-secondary')}; }
  .close {
    position: absolute;
    top: ${litVar('--lab-space-md', '1rem')};
    right: var(--_sheet-inset);
    width: ${litVar('--lab-space-7', '1.75rem')};
    height: ${litVar('--lab-space-7', '1.75rem')};
    border: 0;
    background: none;
    color: ${litVar('--lab-label-secondary')};
    font: inherit;
    cursor: pointer;
  }
  .preset {
    position: absolute;
    width: 0;
    max-height: 100%;
    visibility: hidden;
    pointer-events: none;
  }
  .preset-full { height: ${litVar('--lab-size-sheet-body-full', '48.5rem')}; }
  .preset-two-thirds { height: ${litVar('--lab-size-sheet-body-two-thirds', '33.75rem')}; }
  .preset-one-third { height: ${litVar('--lab-size-sheet-body-one-third', '16.875rem')}; }
  .overlap { height: var(--_sheet-overlap); }
  .gap { height: var(--_sheet-gap); }
`;

/** Нижняя модальная поверхность: LabModal владеет focus/portal, LabMotion — движением. */
export class LabSheet extends LabModal {
  static override properties = {
    open: { type: Boolean, reflect: true },
    position: {
      reflect: true,
      converter: {
        fromAttribute: (value: string | null) =>
          value === null ? 'half' : parseSheetPosition(value),
      },
    },
  };

  declare open: boolean;
  private selectedPosition: LabSheetPosition = 'half';
  private present = false;
  private sheetMotion?: SheetMotion;
  private disposeMaterial?: () => void;
  protected override portalAttribute = 'data-lab-sheet-portal';

  get position(): LabSheetPosition {
    return this.selectedPosition;
  }

  set position(value: LabSheetPosition) {
    const next = parseSheetPosition(value);
    const previous = this.selectedPosition;
    this.selectedPosition = next;
    this.requestUpdate('position', previous);
  }

  constructor() {
    super();
    this.open = false;
    this.position = 'half';
    this.closable = false;
  }

  protected override get portalStyleSheets(): CSSStyleSheet[] {
    return [materialStyles.styleSheet as CSSStyleSheet, sheetStyles.styleSheet as CSSStyleSheet];
  }

  protected override get portalAttributes(): Readonly<Record<string, string>> {
    return { 'data-position': this.position };
  }

  protected override get dialogBehaviorProps(): Pick<dialogMachine.Props, 'open' | 'aria-label'> {
    if (typeof this.open !== 'boolean') throw new TypeError('LabSheet: open должен быть Boolean');
    return {
      // До завершения exit сохраняются trap, блокировка фона и focus ownership.
      open: this.open || this.present,
      'aria-label': this.getAttribute('aria-label') ?? (this.heading || 'Панель'),
    };
  }

  protected override onDialogOpenChange(details: dialogMachine.OpenChangeDetails): void {
    if (details.open === this.open) return;
    this.open = details.open;
    super.onDialogOpenChange(details);
  }

  protected override floatingTemplate(): TemplateResult {
    return html`
      <div class="backdrop" part="backdrop" hidden></div>
      <div class="positioner" part="positioner" hidden>
        <div class="sheet-frame">
          <div class="ghost lab-material-ghost--sheet" part="ghost" data-veil="bottom" aria-hidden="true"></div>
          <div class="content" part="content" hidden>
            <div class="surface lab-material lab-material--sheet" part="surface">
              <button class="handle" part="handle" type="button" aria-label="Изменить высоту панели">
                <span class="indicator" part="indicator"></span>
              </button>
              <div class="panel-body" part="scroll-area">
                ${
                  this.heading || this.description
                    ? html`
                  <div class="panel-heading">
                    ${this.heading ? html`<h2 class="heading" part="heading">${this.heading}</h2>` : null}
                    ${this.description ? html`<p class="description" part="description">${this.description}</p>` : null}
                  </div>
                `
                    : null
                }
                <div class="body" part="body"></div>
              </div>
              ${this.closable ? html`<button class="close" part="close-trigger" type="button" aria-label="Закрыть">×</button>` : null}
            </div>
          </div>
        </div>
        <div class="preset preset-full" aria-hidden="true"></div>
        <div class="preset preset-two-thirds" aria-hidden="true"></div>
        <div class="preset preset-one-third" aria-hidden="true"></div>
        <div class="preset overlap" aria-hidden="true"></div>
        <div class="preset gap" aria-hidden="true"></div>
      </div>
    `;
  }

  protected override afterFloatingUpdate(root: ShadowRoot, modalOpen: boolean): void {
    const positioner = root.querySelector<HTMLElement>('.positioner');
    const frame = root.querySelector<HTMLElement>('.sheet-frame');
    const surface = root.querySelector<HTMLElement>('.surface');
    const handle = root.querySelector<HTMLElement>('.handle');
    const panel = root.querySelector<HTMLElement>('.panel-body');
    const body = root.querySelector<HTMLElement>('.body');
    if (!positioner || !frame || !surface || !handle || !panel || !body) return;
    if (this.open) this.present = true;
    if (!this.sheetMotion || (!this.sheetMotion.active && this.open)) {
      const view = this.ownerDocument.defaultView;
      if (!view) return;
      const measure = (selector: string): number => {
        const element = root.querySelector<HTMLElement>(selector);
        return element ? Number.parseFloat(view.getComputedStyle(element).height) : 0;
      };
      this.sheetMotion = mountSheetMotion(
        frame,
        handle,
        [handle, panel, body, ...root.querySelectorAll('.preset')],
        {
          readGeometry: () => {
            const viewport = positioner.getBoundingClientRect().height || view.innerHeight;
            const surfaceStyle = view.getComputedStyle(surface);
            const gap = measure('.gap');
            // Body остаётся измеряемым и при пустом adapter wrapper. Скрытие
            // измеряемого узла создало бы цикл: новое содержимое имело бы height=0.
            const bodyHeight = body.getBoundingClientRect().height;
            const headingHeight =
              root.querySelector('.panel-heading')?.getBoundingClientRect().height ?? 0;
            const natural = bodyHeight + headingHeight;
            const bodyGap = bodyHeight > 0 && headingHeight > 0 ? gap : 0;
            surface.style.setProperty(
              '--_sheet-panel-gap',
              natural > 0 ? 'var(--_sheet-gap)' : '0px',
            );
            panel.style.setProperty('--_sheet-body-gap', bodyGap > 0 ? 'var(--_sheet-gap)' : '0px');
            const flex =
              measure('.handle') +
              Number.parseFloat(surfaceStyle.paddingBottom) +
              (natural > 0 ? gap + natural + bodyGap : 0);
            return sheetGeometry(viewport, measure('.overlap'), {
              full: measure('.preset-full'),
              'two-thirds': measure('.preset-two-thirds'),
              'one-third': measure('.preset-one-third'),
              flex,
            });
          },
          onPositionChange: (position) => {
            if (position === this.position) return;
            this.position = position;
            this.dispatchEvent(
              new CustomEvent<SheetPositionChangeDetails>('position-change', {
                detail: { position },
                bubbles: true,
                composed: true,
              }),
            );
          },
          onOpenChange: (open) => this.onDialogOpenChange({ open }),
          onClosed: () => {
            if (!this.present || this.open) return;
            this.present = false;
            this.requestUpdate();
          },
          onError: (error) => {
            this.open = false;
            this.present = false;
            try {
              this.completeFailedDialogFocus();
            } finally {
              this.dispatchEvent(
                new CustomEvent<SheetMotionErrorDetails>('motion-error', {
                  detail: { error },
                  bubbles: true,
                  composed: true,
                }),
              );
              this.requestUpdate();
            }
          },
        },
      );
    }
    // Runtime материала не пересоздаётся при замене завершённого Motion scope.
    if (!this.disposeMaterial) this.disposeMaterial = mountMaterialRuntime(frame);
    this.sheetMotion.update(this.open, this.position);
    // Закрытый idle portal остаётся скрытым: motion не управляет modal visibility.
    if (!modalOpen && !this.open) positioner.hidden = true;
  }

  override disconnectedCallback(): void {
    try {
      this.sheetMotion?.dispose();
    } finally {
      this.sheetMotion = undefined;
      try {
        this.disposeMaterial?.();
      } finally {
        this.disposeMaterial = undefined;
        this.present = false;
        super.disconnectedCallback();
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-sheet': LabSheet;
  }
}

export function registerLabSheet(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('lab-sheet')) {
    customElements.define('lab-sheet', LabSheet);
  }
}
