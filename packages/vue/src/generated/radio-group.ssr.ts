/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/radio-group';
import type { LabRadioGroup } from '@labpics/ui-core/radio-group';

/** SSR-пропы <lab-radio-group> (атрибуты/свойства), взяты из класса ядра (LabRadioGroup). */
export type RadioGroupSsrProps = Partial<Pick<LabRadioGroup, 'type' | 'size' | 'orientation' | 'value' | 'defaultValue' | 'disabled' | 'name' | 'label' | 'items'>>;
/** SSR-слоты <lab-radio-group> — предрендеренные строки контента. */
export type RadioGroupSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-radio-group> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderRadioGroup(
  props: RadioGroupSsrProps = {},
): string {
  return renderToString(html`<lab-radio-group
      type=${ifDefined(props.type)}
      size=${ifDefined(props.size)}
      orientation=${ifDefined(props.orientation)}
      value=${ifDefined(props.value)}
      default-value=${ifDefined(props.defaultValue)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      name=${ifDefined(props.name)}
      label=${ifDefined(props.label)}
      .items=${props.items}
    ></lab-radio-group>`);
}
