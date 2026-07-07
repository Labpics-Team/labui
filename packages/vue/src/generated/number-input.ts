/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/number-input';
import type { LabNumberInput } from '@labpics/ui-core/number-input';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-number-input>, взятые прямо из класса ядра (LabNumberInput). */
export type NumberInputProps = Pick<LabNumberInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'placeholder' | 'min' | 'max' | 'step' | 'scrubber' | 'allowMouseWheel' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>;

/**
 * <NumberInput> — тонкая Vue-обёртка над <lab-number-input>.
 * События: onValueChange, onValueCommit.
 */
export const NumberInput: LabComponent<NumberInputProps, 'value-change' | 'value-commit'> = createLabComponent<
  NumberInputProps,
  'value-change' | 'value-commit'
>('lab-number-input', {
  props: ['type', 'size', 'label', 'labelHidden', 'helper', 'error', 'value', 'defaultValue', 'placeholder', 'min', 'max', 'step', 'scrubber', 'allowMouseWheel', 'readonly', 'disabled', 'required', 'invalid', 'name'],
  specs: [
      { name: 'type', attr: 'type', kind: 'string' },
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'label', attr: 'label', kind: 'string' },
      { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
      { name: 'helper', attr: 'helper', kind: 'string' },
      { name: 'error', attr: 'error', kind: 'string' },
      { name: 'value', attr: 'value', kind: 'string' },
      { name: 'defaultValue', attr: 'default-value', kind: 'string' },
      { name: 'placeholder', attr: 'placeholder', kind: 'string' },
      { name: 'min', attr: 'min', kind: 'string' },
      { name: 'max', attr: 'max', kind: 'string' },
      { name: 'step', attr: 'step', kind: 'string' },
      { name: 'scrubber', attr: 'scrubber', kind: 'boolean' },
      { name: 'allowMouseWheel', attr: 'allow-mouse-wheel', kind: 'boolean' },
      { name: 'readonly', attr: 'readonly', kind: 'boolean' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'required', attr: 'required', kind: 'boolean' },
      { name: 'invalid', attr: 'invalid', kind: 'boolean' },
      { name: 'name', attr: 'name', kind: 'string' },
  ],
  events: ['value-change', 'value-commit'],
});
