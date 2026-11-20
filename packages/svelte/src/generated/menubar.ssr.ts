/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/menubar';
import type { LabMenubar } from '@labpics/ui-core/menubar';

/** SSR-пропы <lab-menubar> (атрибуты/свойства), взяты из класса ядра (LabMenubar). */
export type MenubarSsrProps = Partial<Pick<LabMenubar, 'label' | 'placement' | 'disabled' | 'checkedValues' | 'defaultCheckedValues' | 'menus' | 'value' | 'defaultValue'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-menubar> — предрендеренные строки контента. */
export type MenubarSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-menubar> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderMenubar(
  props: MenubarSsrProps = {},
): string {
  return renderToString(html`<lab-menubar
      label=${ifDefined(props.label)}
      placement=${ifDefined(props.placement)}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      .checkedValues=${props.checkedValues === undefined ? noChange : props.checkedValues}
      .defaultCheckedValues=${props.defaultCheckedValues === undefined ? noChange : props.defaultCheckedValues}
      .menus=${props.menus === undefined ? noChange : props.menus}
      value=${ifDefined(props.value)}
      default-value=${ifDefined(props.defaultValue)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    ></lab-menubar>`);
}
