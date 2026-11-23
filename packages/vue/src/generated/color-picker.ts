/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/color-picker';
import type { LabColorPicker } from '@labpics/ui-core/color-picker';

/** Пропы <lab-color-picker>, взятые прямо из класса ядра (LabColorPicker). */
export type ColorPickerProps = Pick<LabColorPicker, 'value' | 'defaultValue' | 'variant' | 'model' | 'defaultVariant' | 'defaultModel' | 'label' | 'name' | 'form' | 'disabled' | 'readonly' | 'required' | 'pickScreenColor'>;

/**
 * <ColorPicker> — тонкая Vue-обёртка над <lab-color-picker>.
 * События: onCloseRequest, onModelChange, onValueChange, onValueChangeEnd, onVariantChange.
 */
export const ColorPicker: LabComponent<ColorPickerProps, 'close-request' | 'model-change' | 'value-change' | 'value-change-end' | 'variant-change'> = createLabComponent<
  ColorPickerProps,
  'close-request' | 'model-change' | 'value-change' | 'value-change-end' | 'variant-change'
>('lab-color-picker', {
  specs: [
      { name: 'value', attr: 'value', kind: 'prop' },
      { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
      { name: 'variant', attr: 'variant', kind: 'string' },
      { name: 'model', attr: 'model', kind: 'string' },
      { name: 'defaultVariant', attr: 'default-variant', kind: 'string' },
      { name: 'defaultModel', attr: 'default-model', kind: 'string' },
      { name: 'label', attr: 'label', kind: 'string' },
      { name: 'name', attr: 'name', kind: 'string' },
      { name: 'form', attr: 'form', kind: 'string' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'readonly', attr: 'readonly', kind: 'boolean' },
      { name: 'required', attr: 'required', kind: 'boolean' },
      { name: 'pickScreenColor', attr: 'pickScreenColor', kind: 'prop' },
  ],
  events: ['close-request', 'model-change', 'value-change', 'value-change-end', 'variant-change'],
});
