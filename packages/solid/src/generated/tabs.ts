/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/tabs';
import type { LabTabs } from '@labpics/ui-core/tabs';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-tabs>, взятые прямо из класса ядра (LabTabs). */
export type TabsProps = Pick<LabTabs, 'orientation' | 'size' | 'activationMode' | 'value' | 'defaultValue' | 'items'>;

/** <Tabs> — тонкая Solid-обёртка над <lab-tabs>. */
export const Tabs: LabSolidComponent<TabsProps, 'value-change'> = createLabComponent<
  TabsProps,
  'value-change'
>('lab-tabs', {
  specs: [
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'activationMode', attr: 'activation-mode', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
    { name: 'defaultValue', attr: 'default-value', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ],
  events: ['value-change'],
});
