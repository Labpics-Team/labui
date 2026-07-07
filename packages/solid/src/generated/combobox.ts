/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/combobox';
import type { LabCombobox } from '@labpics/ui-core/combobox';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-combobox>, взятые прямо из класса ядра (LabCombobox). */
export type ComboboxProps = Pick<LabCombobox, 'type' | 'size' | 'placement' | 'multiple' | 'disabled' | 'readonly' | 'required' | 'invalid' | 'name' | 'placeholder' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'items'>;

/** <Combobox> — тонкая Solid-обёртка над <lab-combobox>. */
export const Combobox: LabSolidComponent<ComboboxProps, 'input-value-change' | 'open-change' | 'value-change'> = createLabComponent<
  ComboboxProps,
  'input-value-change' | 'open-change' | 'value-change'
>('lab-combobox', {
  specs: [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'placement', attr: 'placement', kind: 'string' },
    { name: 'multiple', attr: 'multiple', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ],
  events: ['input-value-change', 'open-change', 'value-change'],
});
