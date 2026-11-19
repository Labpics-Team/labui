/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';
import '@labpics/ui-core/slider';
import type { LabSlider } from '@labpics/ui-core/slider';

/** Пропы <lab-slider>, взятые прямо из класса ядра (LabSlider). */
export type SliderProps = Pick<LabSlider, 'variant' | 'orientation' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'name' | 'form' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'showValue' | 'readonly' | 'disabled' | 'invalid' | 'thumbLabels'>;

/** <Slider> — тонкая Solid-обёртка над <lab-slider>. */
export const Slider: LabSolidComponent<SliderProps, 'value-change' | 'value-change-end'> = createLabComponent<
  SliderProps,
  'value-change' | 'value-change-end'
>('lab-slider', {
  specs: [
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'form', attr: 'form', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'step', attr: 'step', kind: 'string' },
    { name: 'showValue', attr: 'show-value', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'thumbLabels', attr: 'thumb-labels', kind: 'prop' },
  ],
  events: ['value-change', 'value-change-end'],
});
