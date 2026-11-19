/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/alert';
import type { LabAlert } from '@labpics/ui-core/alert';

/** SSR-пропы <lab-alert> (атрибуты/свойства), взяты из класса ядра (LabAlert). */
export type AlertSsrProps = Partial<Pick<LabAlert, 'open' | 'controlled' | 'type' | 'quantity' | 'heading' | 'description' | 'showIcon' | 'closeLabel' | 'announcement' | 'notificationKey'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-alert> — предрендеренные строки контента. */
export type AlertSsrSlots = { icon?: string };

/**
 * Рендерит <lab-alert> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderAlert(
  props: AlertSsrProps = {},
  slots: AlertSsrSlots = {},
): string {
  return renderToString(html`<lab-alert
      .open=${props.open === undefined ? noChange : props.open}
      .controlled=${props.controlled === undefined ? noChange : props.controlled}
      type=${ifDefined(props.type)}
      quantity=${ifDefined(props.quantity)}
      heading=${ifDefined(props.heading)}
      description=${ifDefined(props.description)}
      .showIcon=${props.showIcon === undefined ? noChange : props.showIcon}
      close-label=${ifDefined(props.closeLabel)}
      announcement=${ifDefined(props.announcement)}
      notification-key=${ifDefined(props.notificationKey)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${slots.icon ? html`<span slot="icon">${unsafeHTML(slots.icon)}</span>` : ''}</lab-alert>`);
}
