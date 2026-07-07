/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/input';
import type { LabInput } from '@labpics/ui-core/input';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-input>, взятые прямо из класса ядра (LabInput). */
export type InputProps = Pick<LabInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'placeholder' | 'inputType' | 'autocomplete' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>;

/** <Input> — тонкая Solid-обёртка над <lab-input>. */
export const Input: LabSolidComponent<InputProps, 'lab-change' | 'lab-input'> = createLabComponent<
  InputProps,
  'lab-change' | 'lab-input'
>('lab-input', {
  specs: [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'inputType', attr: 'input-type', kind: 'string' },
    { name: 'autocomplete', attr: 'autocomplete', kind: 'string' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ],
  events: ['lab-change', 'lab-input'],
});
