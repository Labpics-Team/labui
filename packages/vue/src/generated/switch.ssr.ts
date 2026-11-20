/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML, slotProjectionShadowHtml } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/switch';
import type { LabSwitch } from '@labpics/ui-core/switch';

/** SSR-пропы <lab-switch> (атрибуты/свойства), взяты из класса ядра (LabSwitch). */
export type SwitchSsrProps = Partial<Pick<LabSwitch, 'type' | 'size' | 'checked' | 'defaultChecked' | 'controlled' | 'disabled' | 'required' | 'icon' | 'name' | 'value'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-switch> — предрендеренные строки контента. */
export type SwitchSsrSlots = { default?: string; iconOff?: string; iconOn?: string; labelStart?: string };

/**
 * Рендерит <lab-switch> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderSwitch(
  props: SwitchSsrProps = {},
  slots: SwitchSsrSlots = {},
): string {
  return renderToString(html`<lab-switch
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      .checked=${props.checked === undefined ? noChange : props.checked}
      .defaultChecked=${props.defaultChecked === undefined ? noChange : props.defaultChecked}
      .controlled=${props.controlled === undefined ? noChange : props.controlled}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .required=${props.required === undefined ? noChange : props.required}
      .icon=${props.icon === undefined ? noChange : props.icon}
      name=${ifDefined(props.name)}
      value=${ifDefined(props.value)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.iconOff ? html`<lab-slot slot="icon-off">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.iconOff)}</lab-slot>` : ''}${slots.iconOn ? html`<lab-slot slot="icon-on">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.iconOn)}</lab-slot>` : ''}${slots.labelStart ? html`<lab-slot slot="label-start">${unsafeHTML(slotProjectionShadowHtml)}${unsafeHTML(slots.labelStart)}</lab-slot>` : ''}${unsafeHTML(slots.default ?? '')}</lab-switch>`);
}
