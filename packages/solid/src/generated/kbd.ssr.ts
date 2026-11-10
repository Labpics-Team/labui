/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined, unsafeHTML } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/kbd';
import type { LabKbd } from '@labpics/ui-core/kbd';

/** SSR-пропы <lab-kbd> (атрибуты/свойства), взяты из класса ядра (LabKbd). */
export type KbdSsrProps = Partial<Pick<LabKbd, 'size'>>;
/** SSR-слоты <lab-kbd> — предрендеренные строки контента. */
export type KbdSsrSlots = { default?: string };

/**
 * Рендерит <lab-kbd> со стилями и Declarative Shadow DOM. Включите строку в
 * серверный ответ через v-html / {@html} / set:html либо серверный HTML-шаблон.
 * Обычная клиентская вставка innerHTML не создаёт declarative shadow root.
 */
export function renderKbd(
  props: KbdSsrProps = {},
  slots: KbdSsrSlots = {},
): string {
  return renderToString(html`<lab-kbd
      size=${ifDefined(props.size)}
    >${unsafeHTML(slots.default ?? '')}</lab-kbd>`);
}
