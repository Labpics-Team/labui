/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/checkbox';
import type { LabCheckbox } from '@labpics/ui-core/checkbox';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-checkbox>, взятые прямо из класса ядра (LabCheckbox). */
export type CheckboxProps = Pick<LabCheckbox, 'type' | 'size' | 'checked' | 'indeterminate' | 'defaultChecked' | 'defaultIndeterminate' | 'disabled' | 'name'>;

/** <Checkbox> — тонкая Solid-обёртка над <lab-checkbox>. */
export const Checkbox: LabSolidComponent<CheckboxProps, 'checked-change'> = createLabComponent<
  CheckboxProps,
  'checked-change'
>('lab-checkbox', {
  specs: [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'checked', attr: 'checked', kind: 'boolean' },
    { name: 'indeterminate', attr: 'indeterminate', kind: 'boolean' },
    { name: 'defaultChecked', attr: 'default-checked', kind: 'boolean' },
    { name: 'defaultIndeterminate', attr: 'default-indeterminate', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ],
  events: ['checked-change'],
});
