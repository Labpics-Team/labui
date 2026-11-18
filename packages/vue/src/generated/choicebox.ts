/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/choicebox';
import type { LabChoicebox } from '@labpics/ui-core/choicebox';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-choicebox>, взятые прямо из класса ядра (LabChoicebox). */
export type ChoiceboxProps = Pick<LabChoicebox, 'layout' | 'multiple' | 'value' | 'defaultValue' | 'controlled' | 'disabled' | 'required' | 'name' | 'label' | 'items'>;

/**
 * <Choicebox> — тонкая Vue-обёртка над <lab-choicebox>.
 * События: onValueChange.
 */
export const Choicebox: LabComponent<ChoiceboxProps, 'value-change'> = createLabComponent<
  ChoiceboxProps,
  'value-change'
>('lab-choicebox', {
  specs: [
      { name: 'layout', attr: 'layout', kind: 'string' },
      { name: 'multiple', attr: 'multiple', kind: 'boolean' },
      { name: 'value', attr: 'value', kind: 'prop' },
      { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
      { name: 'controlled', attr: 'controlled', kind: 'boolean' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'required', attr: 'required', kind: 'boolean' },
      { name: 'name', attr: 'name', kind: 'string' },
      { name: 'label', attr: 'label', kind: 'string' },
      { name: 'items', attr: 'items', kind: 'prop' },
  ],
  events: ['value-change'],
});
