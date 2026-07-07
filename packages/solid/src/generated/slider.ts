/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/slider';
import type { LabSlider } from '@labpics/ui-core/slider';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-slider>, взятые прямо из класса ядра (LabSlider). */
export type SliderProps = Pick<LabSlider, 'size' | 'orientation' | 'label' | 'labelHidden' | 'helper' | 'error' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'marks' | 'showValue' | 'readonly' | 'disabled' | 'invalid' | 'name'>;

/** <Slider> — тонкая Solid-обёртка над <lab-slider>. */
export const Slider: LabSolidComponent<SliderProps, 'value-change' | 'value-change-end'> = createLabComponent<
  SliderProps,
  'value-change' | 'value-change-end'
>('lab-slider', {
  specs: [
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'step', attr: 'step', kind: 'string' },
    { name: 'marks', attr: 'marks', kind: 'prop' },
    { name: 'showValue', attr: 'show-value', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
  ],
  events: ['value-change', 'value-change-end'],
});
