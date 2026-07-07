import '@labpics/ui-core/menu';
import type { LabMenu } from '@labpics/ui-core/menu';
/** SSR-пропы <lab-menu> (атрибуты/свойства), взяты из класса ядра (LabMenu). */
export type MenuSsrProps = Partial<Pick<LabMenu, 'size' | 'placement' | 'disabled' | 'label' | 'items'>>;
/** SSR-слоты <lab-menu> — предрендеренные строки контента. */
export type MenuSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-menu> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderMenu(props?: MenuSsrProps): string;
//# sourceMappingURL=menu.ssr.d.ts.map