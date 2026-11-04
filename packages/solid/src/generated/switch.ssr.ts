/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/switch';
import type { LabSwitch } from '@labpics/ui-core/switch';

/** SSR-пропы <lab-switch> (атрибуты/свойства), взяты из класса ядра (LabSwitch). */
export type SwitchSsrProps = Partial<Pick<LabSwitch, 'type' | 'size' | 'checked' | 'defaultChecked' | 'disabled' | 'name'>>;
/** SSR-слоты <lab-switch> — предрендеренные строки контента. */
export type SwitchSsrSlots = { default?: string; iconOff?: string; iconOn?: string };

/**
 * Рендерит <lab-switch> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderSwitch(
  props: SwitchSsrProps = {},
  slots: SwitchSsrSlots = {},
): string {
  return renderToString(html`<lab-switch
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      .checked=${props.checked === undefined ? noChange : Boolean(props.checked)}
      .defaultChecked=${props.defaultChecked === undefined ? noChange : Boolean(props.defaultChecked)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      name=${ifDefined(props.name)}
    >${slots.iconOff ? html`<span slot="icon-off">${unsafeHTML(slots.iconOff)}</span>` : ''}${slots.iconOn ? html`<span slot="icon-on">${unsafeHTML(slots.iconOn)}</span>` : ''}${unsafeHTML(slots.default ?? '')}</lab-switch>`);
}
