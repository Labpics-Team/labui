/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/slider';
import type { LabSlider } from '@labpics/ui-core/slider';

/** SSR-пропы <lab-slider> (атрибуты/свойства), взяты из класса ядра (LabSlider). */
export type SliderSsrProps = Partial<Pick<LabSlider, 'size' | 'orientation' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'marks' | 'showValue' | 'readonly' | 'disabled' | 'invalid' | 'name'>>;
/** SSR-слоты <lab-slider> — предрендеренные строки контента. */
export type SliderSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-slider> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderSlider(
  props: SliderSsrProps = {},
): string {
  return renderToString(html`<lab-slider
      size=${ifDefined(props.size)}
      orientation=${ifDefined(props.orientation)}
      label=${ifDefined(props.label)}
      .labelHidden=${props.labelHidden === undefined ? noChange : Boolean(props.labelHidden)}
      helper=${ifDefined(props.helper)}
      error=${ifDefined(props.error)}
      .value=${props.value === undefined ? noChange : props.value}
      .defaultValue=${props.defaultValue === undefined ? noChange : props.defaultValue}
      min=${ifDefined(props.min)}
      max=${ifDefined(props.max)}
      step=${ifDefined(props.step)}
      .marks=${props.marks === undefined ? noChange : props.marks}
      .showValue=${props.showValue === undefined ? noChange : Boolean(props.showValue)}
      .readonly=${props.readonly === undefined ? noChange : Boolean(props.readonly)}
      .disabled=${props.disabled === undefined ? noChange : Boolean(props.disabled)}
      .invalid=${props.invalid === undefined ? noChange : Boolean(props.invalid)}
      name=${ifDefined(props.name)}
    ></lab-slider>`);
}
