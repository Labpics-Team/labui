/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/pin-input';
import type { LabPinInput } from '@labpics/ui-core/pin-input';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-pin-input>, взятые прямо из класса ядра (LabPinInput). */
export type PinInputProps = Pick<LabPinInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'count' | 'valueType' | 'mask' | 'otp' | 'placeholder' | 'value' | 'defaultValue' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>;

/** <PinInput> — тонкая Solid-обёртка над <lab-pin-input>. */
export const PinInput: LabSolidComponent<PinInputProps, 'value-change' | 'value-complete' | 'value-invalid'> = createLabComponent<
  PinInputProps,
  'value-change' | 'value-complete' | 'value-invalid'
>('lab-pin-input', {
  specs: [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'count', attr: 'count', kind: 'string' },
    { name: 'valueType', attr: 'value-type', kind: 'string' },
    { name: 'mask', attr: 'mask', kind: 'boolean' },
    { name: 'otp', attr: 'otp', kind: 'boolean' },
    { name: 'placeholder', attr: 'placeholder', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ],
  events: ['value-change', 'value-complete', 'value-invalid'],
});
