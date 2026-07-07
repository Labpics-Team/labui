/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/select';
import type { LabSelect } from '@labpics/ui-core/select';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-select>, взятые прямо из класса ядра (LabSelect). */
export type SelectProps = Pick<LabSelect, 'size' | 'placement' | 'multiple' | 'disabled' | 'name' | 'placeholder' | 'label' | 'value' | 'defaultValue' | 'items'>;

/** <Select> — тонкая Solid-обёртка над <lab-select>. */
export const Select: LabSolidComponent<SelectProps, 'open-change' | 'value-change'> = createLabComponent<
  SelectProps,
  'open-change' | 'value-change'
>('lab-select', {
  specs: [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'multiple', attr: 'multiple', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ],
  events: ['open-change', 'value-change'],
});
