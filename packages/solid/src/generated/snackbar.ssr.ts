/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, noChange } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/snackbar';
import type { LabSnackbar } from '@labpics/ui-core/snackbar';

/** SSR-пропы <lab-snackbar> (атрибуты/свойства), взяты из класса ядра (LabSnackbar). */
export type SnackbarSsrProps = Partial<Pick<LabSnackbar, 'open' | 'message' | 'duration' | 'actionLabel' | 'notificationKey'>> & { 'aria-label'?: string; 'form'?: string };
/** SSR-слоты <lab-snackbar> — предрендеренные строки контента. */
export type SnackbarSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-snackbar> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderSnackbar(
  props: SnackbarSsrProps = {},
): string {
  return renderToString(html`<lab-snackbar
      .open=${props.open === undefined ? noChange : props.open}
      message=${ifDefined(props.message)}
      duration=${ifDefined(props.duration)}
      action-label=${ifDefined(props.actionLabel)}
      notification-key=${ifDefined(props.notificationKey)}
      aria-label=${ifDefined(props['aria-label'])}
      form=${ifDefined(props['form'])}
    ></lab-snackbar>`);
}
