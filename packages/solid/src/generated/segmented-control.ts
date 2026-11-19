/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/segmented-control';
import type { LabSegmentedControl } from '@labpics/ui-core/segmented-control';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-segmented-control>, взятые прямо из класса ядра (LabSegmentedControl). */
export type SegmentedControlProps = Pick<LabSegmentedControl, 'shape' | 'value' | 'defaultValue' | 'name' | 'label' | 'dir' | 'disabled' | 'required' | 'items'>;

/** <SegmentedControl> — тонкая Solid-обёртка над <lab-segmented-control>. */
export const SegmentedControl: LabSolidComponent<SegmentedControlProps, 'value-change'> = createLabComponent<
  SegmentedControlProps,
  'value-change'
>('lab-segmented-control', {
  specs: [
    { name: 'shape', attr: 'shape', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'string' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'dir', attr: 'dir', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ],
  events: ['value-change'],
});
