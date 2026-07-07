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
export declare function renderAvatar(props?: AvatarSsrProps): string;
//# sourceMappingURL=avatar.ssr.d.ts.map