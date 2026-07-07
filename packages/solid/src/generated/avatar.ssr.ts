/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { html, renderToString, ifDefined } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/avatar';
import type { LabAvatar } from '@labpics/ui-core/avatar';

/** SSR-пропы <lab-avatar> (атрибуты/свойства), взяты из класса ядра (LabAvatar). */
export type AvatarSsrProps = Partial<Pick<LabAvatar, 'size' | 'color' | 'status' | 'src' | 'name'>>;
/** SSR-слоты <lab-avatar> — предрендеренные строки контента. */
export type AvatarSsrSlots = Record<never, never>;

/**
 * Рендерит <lab-avatar> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export function renderAvatar(
  props: AvatarSsrProps = {},
): string {
  return renderToString(html`<lab-avatar
      size=${ifDefined(props.size)}
      color=${ifDefined(props.color)}
      status=${ifDefined(props.status)}
      src=${ifDefined(props.src)}
      name=${ifDefined(props.name)}
    ></lab-avatar>`);
}
