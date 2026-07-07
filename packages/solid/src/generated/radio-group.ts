/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/radio-group';
import type { LabRadioGroup } from '@labpics/ui-core/radio-group';
import { type LabSolidComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-radio-group>, взятые прямо из класса ядра (LabRadioGroup). */
export type RadioGroupProps = Pick<LabRadioGroup, 'type' | 'size' | 'orientation' | 'value' | 'defaultValue' | 'disabled' | 'name' | 'label' | 'items'>;

/** <RadioGroup> — тонкая Solid-обёртка над <lab-radio-group>. */
export const RadioGroup: LabSolidComponent<RadioGroupProps, 'value-change'> = createLabComponent<
  RadioGroupProps,
  'value-change'
>('lab-radio-group', {
  specs: [
    { name: 'type', attr: 'type', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'orientation', attr: 'orientation', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'string' },
    { name: 'defaultValue', attr: 'default-value', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'items', attr: 'items', kind: 'prop' },
  ],
  events: ['value-change'],
});
