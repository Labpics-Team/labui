import { symbol as checkmark } from '@labpics/icons/symbols/checkmark';
import { mountMaterialRuntime } from '@labpics/ui-materials';
import { materialCss } from '@labpics/ui-materials/css';
import { VanillaMachine, normalizeProps } from '@zag-js/vanilla';
import {
  type PropertyValues,
  type TemplateResult,
  css,
  html,
  isServer,
  nothing,
  unsafeCSS,
} from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import '../icon/index.js';
import {
  type CalendarApi,
  type CalendarSchema,
  calendarBehavior,
  calendarCell,
  calendarProps,
  calendarTableProps,
  calendarTitle,
  listenCalendarFocus,
} from './behavior.js';
import {
  type CalendarChangeDetails,
  type CalendarEvents,
  type CalendarMonthChangeDetails,
  type CalendarOptions,
  type CalendarTranslations,
  type LabCalendarSelection,
  type LabCalendarSize,
  calendarCanCommit,
  calendarComplete,
  calendarDate,
  calendarFocus,
  calendarMonth,
  calendarToday,
  calendarValue,
  calendarWeeks,
  calendarWords,
} from './contract.js';
import { calendarCss } from './styles.js';
export type {
  CalendarChangeDetails,
  CalendarEvents,
  CalendarMonthChangeDetails,
  CalendarTranslations,
  LabCalendarSelection,
  LabCalendarSize,
} from './contract.js';

/** Inline Gregorian calendar. Values and form entries are ISO dates, never timestamps. */
export class LabCalendar extends LabElement {
  static formAssociated = true;
  static override properties = {
    dir: { reflect: true },
    size: { reflect: true },
    selection: { reflect: true },
    value: { attribute: false },
    defaultValue: { attribute: false },
    month: {},
    defaultMonth: { attribute: 'default-month' },
    locale: {},
    firstDayOfWeek: { type: Number, attribute: 'first-day-of-week' },
    today: {},
    min: {},
    max: {},
    disabled: { type: Boolean, reflect: true },
    readonly: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    name: { reflect: true },
    label: {},
    events: { attribute: false },
    markers: { attribute: false },
    isDateUnavailable: { attribute: false },
    unavailableDates: { attribute: false },
    translations: { attribute: false },
    internalValue: { state: true },
    internalMonth: { state: true },
    internalFocus: { state: true },
    pendingFocus: { state: true },
    disabledByForm: { state: true },
  };
  declare size: LabCalendarSize;
  declare selection: LabCalendarSelection;
  declare value: string[] | null;
  declare defaultValue: string[];
  declare month: string | undefined;
  declare defaultMonth: string | undefined;
  declare locale: string;
  declare firstDayOfWeek: number | undefined;
  declare today: string;
  declare min: string | undefined;
  declare max: string | undefined;
  declare disabled: boolean;
  declare readonly: boolean;
  declare required: boolean;
  declare name: string;
  declare label: string;
  declare events: Record<string, CalendarEvents | number>;
  declare markers: string[];
  declare isDateUnavailable: ((date: string) => boolean) | undefined;
  declare unavailableDates: string[];
  declare translations: Partial<CalendarTranslations>;
  private declare internalValue: string[] | undefined;
  private declare internalMonth: string | undefined;
  private declare internalFocus: string | undefined;
  private declare pendingFocus: string | undefined;
  private declare disabledByForm: boolean;
  private readonly ctl: ZagController<CalendarSchema, CalendarApi>;
  private readonly internals?: ElementInternals;
  private initialValue?: string[];
  private initialMonth?: string;
  private disposeMaterial?: () => void;
  private stopFocusTracking?: () => void;
  private pendingKeyboardFocus = false;

  constructor() {
    super();
    this.size = 's';
    this.selection = 'single';
    this.value = null;
    this.defaultValue = [];
    this.month = undefined;
    this.defaultMonth = undefined;
    this.locale = 'en-US';
    this.firstDayOfWeek = undefined;
    this.today = calendarToday();
    this.min = undefined;
    this.max = undefined;
    this.disabled = false;
    this.readonly = false;
    this.required = false;
    this.name = '';
    this.label = 'Calendar';
    this.events = {};
    this.markers = [];
    this.isDateUnavailable = undefined;
    this.unavailableDates = [];
    this.translations = {};
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
    this.addEventListener('invalid', (event) => {
      event.preventDefault();
      this.focusDate();
    });
    this.ctl = this.runMachine(calendarBehavior, () => this.machineProps());
  }
  private get options(): CalendarOptions {
    return {
      selection: this.selection,
      locale: this.locale,
      firstDayOfWeek: this.firstDayOfWeek,
      today: this.today,
      min: this.min,
      max: this.max,
      disabled: this.disabled || this.disabledByForm,
      readOnly: this.readonly,
      events: this.events,
      markers: this.markers,
      isDateUnavailable: this.isDateUnavailable,
      unavailableDates: this.unavailableDates,
      translations: this.translations,
    };
  }
  get selectedDates(): string[] {
    return calendarValue(this.value ?? this.internalValue ?? this.defaultValue, this.selection);
  }
  get visibleMonth(): string {
    return calendarMonth(
      this.month ?? this.internalMonth ?? this.defaultMonth ?? this.selectedDates[0] ?? this.today,
    );
  }
  private get focusedDate(): string {
    const acceptedPending =
      this.pendingFocus && calendarMonth(this.pendingFocus) === this.visibleMonth
        ? this.pendingFocus
        : undefined;
    return calendarFocus(
      acceptedPending ?? this.internalFocus ?? this.selectedDates[0] ?? this.today,
      this.visibleMonth,
      this.options,
    );
  }
  private machineProps() {
    return calendarProps(
      this.uid,
      this.selectedDates,
      this.focusedDate,
      this.options,
      (dates) => {
        const value = calendarValue(dates, this.selection);
        if (!calendarCanCommit(value, this.options)) return;
        if (this.value === null) this.internalValue = value;
        this.dispatchEvent(
          new CustomEvent<CalendarChangeDetails>('value-change', {
            detail: { value },
            bubbles: true,
            composed: true,
          }),
        );
      },
      (date) => {
        const month = calendarMonth(date);
        if (month === this.visibleMonth) {
          this.internalFocus = date;
          this.pendingFocus = undefined;
          return;
        }
        if (this.month === undefined) {
          this.internalMonth = month;
          this.internalFocus = date;
          this.pendingFocus = undefined;
        } else {
          this.pendingFocus = date;
          this.pendingKeyboardFocus =
            this.renderRoot.querySelector('.lab-calendar-day:focus') !== null;
        }
        this.dispatchEvent(
          new CustomEvent<CalendarMonthChangeDetails>('month-change', {
            detail: { month },
            bubbles: true,
            composed: true,
          }),
        );
      },
      this.dir === 'rtl' ||
        (!isServer && this.isConnected && getComputedStyle(this).direction === 'rtl')
        ? 'rtl'
        : 'ltr',
    );
  }
  private get api(): CalendarApi {
    return isServer || !this.isConnected
      ? calendarBehavior.connect(
          new VanillaMachine<CalendarSchema>(calendarBehavior.machine, () => this.machineProps())
            .service,
          normalizeProps,
        )
      : this.ctl.api;
  }
  protected override willUpdate(_changed: PropertyValues): void {
    this.initialValue ??= [...this.selectedDates];
    this.initialMonth ??= this.visibleMonth;
    this.internalValue ??= [...this.selectedDates];
    this.internalMonth ??= this.visibleMonth;
  }
  get form(): HTMLFormElement | null {
    return this.internals?.form ?? null;
  }
  get validity(): ValidityState | undefined {
    return this.internals?.validity;
  }
  checkValidity(): boolean {
    return this.internals?.checkValidity() ?? true;
  }
  reportValidity(): boolean {
    return this.internals?.reportValidity() ?? true;
  }
  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    if (this.value === null) this.internalValue = [...(this.initialValue ?? [])];
    if (this.month === undefined) this.internalMonth = this.initialMonth;
    this.internalFocus = undefined;
    this.pendingFocus = undefined;
    this.pendingKeyboardFocus = false;
  }
  formStateRestoreCallback(state: string | File | FormData): void {
    if (this.value !== null || typeof state !== 'string') return;
    try {
      this.internalValue = calendarValue(JSON.parse(state), this.selection);
    } catch {
      /* Ignore malformed browser state. */
    }
  }
  private focusDate(): void {
    this.renderRoot.querySelector<HTMLElement>('.lab-calendar-day[tabindex="0"]')?.focus();
  }
  static override styles = [
    css`:host{display:block;min-inline-size:0;max-inline-size:100%;}`,
    unsafeCSS(materialCss),
    unsafeCSS(calendarCss),
  ];
  override updated(): void {
    const api = this.api;
    const table = this.renderRoot.querySelector<HTMLElement>('.lab-calendar-grid');
    if (table)
      this.ctl.spread(table, {
        ...calendarTableProps(api, this.options),
        'aria-label': `${this.label}, ${calendarTitle(api)}`,
      });
    for (const [selector, props] of [
      ['.lab-calendar-prev', api.getPrevTriggerProps()],
      ['.lab-calendar-next', api.getNextTriggerProps()],
    ] as const) {
      const node = this.renderRoot.querySelector(selector);
      if (node)
        this.ctl.spread(node, {
          ...props,
          'aria-label': selector.endsWith('prev')
            ? calendarWords(this.options).previousMonth
            : calendarWords(this.options).nextMonth,
        });
    }
    for (const button of this.renderRoot.querySelectorAll<HTMLButtonElement>('.lab-calendar-day')) {
      const date = calendarDate(button.dataset.date ?? '');
      const cell = calendarCell(api, date, this.options);
      this.ctl.spread(button, {
        ...api.getDayTableCellTriggerProps({
          value: date,
          disabled: this.options.disabled || this.readonly,
        }),
        onpointermove: undefined,
        'aria-label': cell.label,
        'data-today': cell.current ? '' : undefined,
        tabindex: this.options.disabled ? -1 : cell.state.focused ? 0 : -1,
      });
    }
    const root = this.renderRoot.querySelector<HTMLElement>('[data-lab-calendar]');
    if (root) this.disposeMaterial ??= mountMaterialRuntime(root);
    if (this.pendingFocus && calendarMonth(this.pendingFocus) === this.visibleMonth) {
      this.internalFocus = this.pendingFocus;
      this.pendingFocus = undefined;
      if (this.pendingKeyboardFocus) this.focusDate();
      this.pendingKeyboardFocus = false;
    }
    const data = new FormData();
    if (!this.options.disabled && this.name)
      for (const date of this.selectedDates) data.append(this.name, date);
    this.internals?.setFormValue(data, JSON.stringify(this.selectedDates));
    const missing =
      this.required &&
      !this.options.disabled &&
      !this.readonly &&
      !calendarComplete(this.selectedDates, this.selection);
    this.internals?.setValidity(
      missing ? { valueMissing: true } : {},
      missing ? calendarWords(this.options).requiredSelection : '',
      this.renderRoot.querySelector<HTMLElement>('.lab-calendar-day[tabindex="0"]') ?? undefined,
    );
  }
  override disconnectedCallback(): void {
    this.stopFocusTracking?.();
    this.stopFocusTracking = undefined;
    this.disposeMaterial?.();
    this.disposeMaterial = undefined;
    super.disconnectedCallback();
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.stopFocusTracking = listenCalendarFocus(this, () => {
      this.pendingKeyboardFocus = false;
    });
  }
  override render(): TemplateResult {
    const api = this.api;
    const words = calendarWords(this.options);
    return html`<fieldset data-lab-calendar data-size=${this.size} ?data-disabled=${this.options.disabled} ?data-readonly=${this.readonly} aria-label=${this.label}>
      <span class="lab-calendar-surface lab-material lab-material--base" aria-hidden="true"></span>
      <div class="lab-calendar-header">
        <button class="lab-calendar-nav lab-calendar-prev" type="button" aria-label=${words.previousMonth} ?disabled=${this.options.disabled || !!api.getPrevTriggerProps().disabled}><span class="lab-calendar-chevron" aria-hidden="true"></span></button>
        <span class="lab-calendar-title" aria-live="polite" aria-atomic="true">${calendarTitle(api)}</span>
        <button class="lab-calendar-nav lab-calendar-next" type="button" aria-label=${words.nextMonth} ?disabled=${this.options.disabled || !!api.getNextTriggerProps().disabled}><span class="lab-calendar-chevron" aria-hidden="true"></span></button>
      </div>
      <div class="lab-calendar-area" id=${api.getContentProps().id}><table class="lab-calendar-grid" role="grid" aria-label=${`${this.label}, ${calendarTitle(api)}`} aria-readonly=${this.readonly ? 'true' : nothing} aria-disabled=${this.options.disabled ? 'true' : nothing} aria-multiselectable=${this.selection === 'range' ? 'true' : nothing}>
        <thead><tr>${api.weekDays.map((day) => html`<th class="lab-calendar-weekday" scope="col" aria-label=${day.long}>${day.narrow}</th>`)}</tr></thead>
        <tbody>${calendarWeeks(api.focusedValue.toString(), this.options).map(
          (week) =>
            html`<tr>${repeat(
              week,
              (date, index) => date?.toString() ?? index,
              (date) => {
                if (!date) return html`<td class="lab-calendar-cell" aria-disabled="true"></td>`;
                const cell = calendarCell(api, date, this.options);
                const disabled = this.options.disabled || this.readonly || !cell.state.selectable;
                return html`<td class="lab-calendar-cell" aria-selected=${cell.selected ? 'true' : 'false'} aria-disabled=${disabled ? 'true' : nothing} aria-current=${cell.current ?? nothing}>
            <button type="button" class="lab-calendar-day" data-date=${cell.iso} aria-label=${cell.label} aria-disabled=${disabled ? 'true' : nothing} tabindex=${!this.options.disabled && cell.state.focused ? 0 : -1} ?data-active=${cell.selected} data-range=${cell.edge ?? nothing}>
              ${api.format(date, { day: 'numeric' })}
              ${cell.count ? html`<span class="lab-calendar-dots" aria-hidden="true">${Array.from({ length: cell.count }, () => html`<i class="lab-calendar-dot"></i>`)}</span>` : nothing}
              ${cell.marked ? html`<span class="lab-calendar-marker" aria-hidden="true"><lab-icon .symbol=${checkmark} .size=${12}></lab-icon></span>` : nothing}
            </button></td>`;
              },
            )}</tr>`,
        )}</tbody>
      </table></div>
    </fieldset>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-calendar': LabCalendar;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-calendar'))
  customElements.define('lab-calendar', LabCalendar);
