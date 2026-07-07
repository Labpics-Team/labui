import '@labpics/ui-core/tabs';
import type { LabTabs } from '@labpics/ui-core/tabs';
/** SSR-пропы <lab-tabs> (атрибуты/свойства), взяты из класса ядра (LabTabs). */
export type TabsSsrProps = Partial<Pick<LabTabs, 'orientation' | 'size' | 'activationMode' | 'value' | 'defaultValue' | 'items'>>;
/** SSR-слоты <lab-tabs> — предрендеренные строки контента. */
export type TabsSsrSlots = Record<never, never>;
/**
 * Рендерит <lab-tabs> в declarative-shadow-DOM строку. Элемент зарегистрирован серверно
 * (side-effect импорт выше), поэтому @lit-labs/ssr рендерит его shadow root — styled
 * first paint без FOUC. Внедряется сырой строкой (v-html / {@html} / innerHTML / set:html).
 */
export declare function renderTabs(props?: TabsSsrProps): string;
//# sourceMappingURL=tabs.ssr.d.ts.map