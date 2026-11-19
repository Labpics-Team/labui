/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/tabs';
import type { LabTabs } from '@labpics/ui-core/tabs';

/** SSR-пропы <lab-tabs> (атрибуты/свойства), взяты из класса ядра (LabTabs). */
export type TabsSsrProps = Partial<Pick<LabTabs, 'variant' | 'edge' | 'orientation' | 'size' | 'activationMode' | 'value' | 'defaultValue' | 'label' | 'dir' | 'items'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-tabs> — предрендеренные строки контента. */
export type TabsSsrSlots = { default?: string; dynamic?: Readonly<Record<string, string>> };

/**
 * Рендерит <lab-tabs> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderTabs(
  props: TabsSsrProps = {},
  slots: TabsSsrSlots = {},
): string {
  return renderToString(html`<lab-tabs
      variant=${ifDefined(props.variant)}
      edge=${ifDefined(props.edge)}
      orientation=${ifDefined(props.orientation)}
      size=${ifDefined(props.size)}
      activation-mode=${ifDefined(props.activationMode)}
      .value=${props.value === undefined ? noChange : props.value}
      default-value=${ifDefined(props.defaultValue)}
      label=${ifDefined(props.label)}
      dir=${ifDefined(props.dir)}
      .items=${props.items === undefined ? noChange : props.items}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    >${Object.entries(slots.dynamic ?? {}).map(([name, content]) => html`<span slot=${name}>${unsafeHTML(content)}</span>`)}${unsafeHTML(slots.default ?? '')}</lab-tabs>`);
}
