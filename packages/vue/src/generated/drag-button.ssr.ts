/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/drag-button';
import type { LabDragButton } from '@labpics/ui-core/drag-button';

/** SSR-пропы <lab-drag-button> (атрибуты/свойства), взяты из класса ядра (LabDragButton). */
export type DragButtonSsrProps = Partial<Pick<LabDragButton, 'label' | 'helperText' | 'showHelper' | 'pendingText' | 'successText' | 'dangerText' | 'status' | 'disabled' | 'resetKey'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-drag-button> — предрендеренные строки контента. */
export type DragButtonSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-drag-button> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderDragButton(
  props: DragButtonSsrProps = {},
): string {
  return renderToString(html`<lab-drag-button
      label=${ifDefined(props.label)}
      helper-text=${ifDefined(props.helperText)}
      .showHelper=${props.showHelper === undefined ? noChange : props.showHelper}
      pending-text=${ifDefined(props.pendingText)}
      success-text=${ifDefined(props.successText)}
      danger-text=${ifDefined(props.dangerText)}
      status=${ifDefined(props.status)}
      .disabled=${props.disabled === undefined ? noChange : props.disabled}
      reset-key=${ifDefined(props.resetKey)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    ></lab-drag-button>`);
}
